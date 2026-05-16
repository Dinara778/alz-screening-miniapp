import { FormEvent, useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { Button } from '../components/Button';
import { ProgressBar } from '../components/ProgressBar';
import { StroopConfirmStep } from '../components/StroopConfirmStep';
import { TestInstruction } from '../components/TestInstruction';
import { TestProgressBanner } from '../components/TestProgressBanner';
import { useApp } from '../context/AppContext';
import { useFaceNameTest } from '../hooks/useFaceNameTest';
import { useFlankerTest } from '../hooks/useFlankerTest';
import { useReactionTest } from '../hooks/useReactionTest';
import { useStroopTest } from '../hooks/useStroopTest';
import { useTimer } from '../hooks/useTimer';
import { buildCognitiveAnalytics } from '../utils/cognitiveAnalytics';
import { nextFlankerPrepDelayMs, nextReactionStimulusDelayMs, pickStudyWordList } from '../utils/generateStimuli';
import { buildStatus, normalizeWords, scoreFaceName, scoreFlanker, scoreReaction, scoreStroop, scoreWordMemory } from '../utils/scoring';
import type { AppStage } from '../types';

const INTERFERENCE_MS = 180000;

function wrapWithTestProgress(stage: AppStage, node: ReactNode) {
  return (
    <div className="flex min-h-[min(78dvh,640px)] w-full flex-col text-slate-950 dark:text-slate-100">
      <div className="shrink-0">
        <TestProgressBanner stage={stage} />
      </div>
      <div className="flex w-full flex-1 flex-col justify-center gap-4">{node}</div>
    </div>
  );
}

export const TestPage = () => {
  const app = useApp();
  const flanker = useFlankerTest(app.sessionSeed);
  const reaction = useReactionTest();
  const stroop = useStroopTest(app.sessionSeed);
  const face = useFaceNameTest(app.sessionSeed);

  const [textInput, setTextInput] = useState('');
  const [faceStudyIndex, setFaceStudyIndex] = useState(0);
  const [reactionPrompt, setReactionPrompt] = useState('Ждите сигнал');
  const [isStimulusVisible, setIsStimulusVisible] = useState(false);
  const [attemptTick, setAttemptTick] = useState(0);
  const reactionRecentDelaysRef = useRef<number[]>([]);

  const deadline = app.interferenceStart ? app.interferenceStart + INTERFERENCE_MS : null;
  const timer = useTimer(deadline);

  useEffect(() => {
    if (app.stage === 'reaction-instruction') {
      reactionRecentDelaysRef.current = [];
    }
  }, [app.stage]);

  useEffect(() => {
    if (app.stage !== 'flanker' || flanker.done) return;
    const prep = nextFlankerPrepDelayMs(app.sessionSeed, flanker.index);
    let timeoutId = 0;
    const startId = window.setTimeout(() => {
      flanker.startTrial();
      timeoutId = window.setTimeout(() => flanker.timeout(), 2000);
    }, prep);
    return () => {
      window.clearTimeout(startId);
      window.clearTimeout(timeoutId);
    };
  }, [app.stage, flanker.index, flanker.done, app.sessionSeed]);

  const stroopAdvanceRef = useRef(false);
  useEffect(() => {
    if (app.stage !== 'stroop') {
      stroopAdvanceRef.current = false;
      return;
    }
    if (!stroop.done || stroopAdvanceRef.current) return;
    stroopAdvanceRef.current = true;
    app.setStroopTrials(stroop.results);
    app.setStage('face-test');
  }, [app.stage, stroop.done, stroop.results, app]);

  useEffect(() => {
    if (app.stage === 'interference-wait' && timer.isFinished) {
      app.setStage('word-delayed');
    }
  }, [app.stage, timer.isFinished]);

  useEffect(() => {
    if (app.stage !== 'reaction' || reaction.isDone) return;
    setIsStimulusVisible(false);
    setReactionPrompt('Ждите сигнал');

    const delay = nextReactionStimulusDelayMs(app.sessionSeed, attemptTick, reactionRecentDelaysRef.current);
    reactionRecentDelaysRef.current = [...reactionRecentDelaysRef.current.slice(-5), delay];

    const startId = window.setTimeout(() => {
      setIsStimulusVisible(true);
      reaction.registerStimulus();
      setReactionPrompt('ЖМИТЕ!');
    }, delay);

    return () => window.clearTimeout(startId);
  }, [app.stage, attemptTick, reaction.isDone, app.sessionSeed]);

  useEffect(() => {
    if (app.stage !== 'reaction') return;

    const handleSpace = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        handleReactionPress();
      }
    };

    window.addEventListener('keydown', handleSpace);
    return () => window.removeEventListener('keydown', handleSpace);
  }, [app.stage, isStimulusVisible, reaction.stimulusAt, app.reactionAnticipations, app.reactionSuccessful]);

  const handleReactionPress = () => {
    if (app.stage !== 'reaction') return;

    if (!isStimulusVisible) {
      app.setReactionAnticipations(app.reactionAnticipations + 1);
      setReactionPrompt('Слишком рано');
      setAttemptTick((v) => v + 1);
      return;
    }

    const outcome = reaction.react();
    if (outcome.status === 'anticipation') {
      setReactionPrompt('Слишком быстрая реакция (<100 мс), повтор');
      setAttemptTick((v) => v + 1);
      return;
    }

    if (outcome.status === 'success') {
      app.setReactionSuccessful([...app.reactionSuccessful, outcome.rt ?? 0]);
      setReactionPrompt(`Время реакции: ${Math.round(outcome.rt ?? 0)} мс`);
      setAttemptTick((v) => v + 1);
    }
  };

  useEffect(() => {
    if (app.stage !== 'reaction') return;
    if (app.reactionSuccessful.length < 30) return;

    if (timer.remainingMs > 0) app.setStage('interference-wait');
    else app.setStage('word-delayed');
  }, [app.stage, app.reactionSuccessful.length, timer.remainingMs]);

  const submitWords = (e: FormEvent, delayed: boolean) => {
    e.preventDefault();
    const words = normalizeWords(textInput);
    setTextInput('');
    if (delayed) {
      app.setDelayedWords(words);
      app.setStage('face-study');
      return;
    }
    app.setImmediateWords(words);
    app.setInterferenceStart(performance.now());
    app.setStage('flanker-instruction');
  };

  const finish = () => {
    const targets =
      app.studyWordList.length >= 5 ? app.studyWordList : pickStudyWordList(app.sessionSeed);
    const wm = scoreWordMemory(app.immediateWords, app.delayedWords, targets);
    const fl = scoreFlanker(app.flankerTrials);
    const rx = scoreReaction(app.reactionSuccessful, app.reactionAnticipations + reaction.anticipations);
    const st = scoreStroop(app.stroopTrials);

    const mappedAnswers = face.trials.map((trial) => ({
      faceId: trial.id,
      selected: face.answers[trial.id],
      correct: trial.correctName,
    }));
    const faceScore = mappedAnswers.filter((a) => a.selected === a.correct).length;
    const fn = scoreFaceName(faceScore, mappedAnswers);

    const profileFlags = buildCognitiveAnalytics({
      id: 'preview',
      date: new Date().toISOString(),
      flags: 0,
      status: 'Когнитивная система работает стабильно',
      participant: app.participant ?? {
        name: 'Не указано',
        email: 'Не указано',
        phone: 'Не указано',
        sex: 'Другой',
        age: 0,
        education: 'Не указано',
        educationYears: 12,
        pcConfidence: 3,
      },
      wordMemory: wm,
      flanker: fl,
      reaction: rx,
      stroop: st,
      faceName: fn,
    }).activePatternCount;

    app.saveResult({
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      flags: profileFlags,
      status: buildStatus(profileFlags),
      participant: app.participant ?? {
        name: 'Не указано',
        email: 'Не указано',
        phone: 'Не указано',
        sex: 'Другой',
        age: 0,
        education: 'Не указано',
        educationYears: 12,
        pcConfidence: 3,
      },
      wordMemory: wm,
      flanker: fl,
      reaction: rx,
      stroop: st,
      faceName: fn,
    });
    app.setStage('result');
  };

  useEffect(() => {
    if (app.stage !== 'word-study') return;
    if (app.studyWordList.length >= 5) return;
    app.setStudyWordList(pickStudyWordList(app.sessionSeed));
  }, [app.stage, app.sessionSeed, app.studyWordList.length]);

  if (app.stage === 'word-study') {
    const words = app.studyWordList;
    if (words.length < 5) {
      return wrapWithTestProgress(
        'word-study',
        <div className="rounded-xl bg-white p-6 text-slate-700">Подготовка списка слов…</div>,
      );
    }
    return wrapWithTestProgress(
      'word-study',
      <>
        <h2 className="app-heading">Задание 1: Эпизодическая память</h2>
        <div className="rounded-xl bg-white p-4 space-y-2">
          <p>Сейчас вы увидите 5 слов. Ваша задача - внимательно их запомнить.</p>
          <p className="font-semibold">Слова: {words.join(', ')}</p>
          <p className="text-sm text-slate-700">
            Через несколько секунд нужно будет воспроизвести слова сразу, а затем повторить их после серии других заданий
            (примерно через 3 минуты).
          </p>
        </div>
        <Button
          type="button"
          className="w-full rounded-2xl py-4 text-[1.0625rem] font-bold leading-snug sm:rounded-3xl sm:py-[1.125rem] sm:text-xl"
          onClick={() => app.setStage('word-immediate')}
        >
          Я запомнил(а)
        </Button>
      </>,
    );
  }

  if (app.stage === 'word-immediate' || app.stage === 'word-delayed') {
    const delayed = app.stage === 'word-delayed';
    return wrapWithTestProgress(
      app.stage,
      <form className="space-y-4" onSubmit={(e) => submitWords(e, delayed)}>
        <h2 className="app-heading">{delayed ? 'Отсроченное воспроизведение' : 'Немедленное воспроизведение'}</h2>
        <p className="text-slate-700">
          {delayed
            ? 'Впишите в поле ниже 5 слов, которые вы запомнили в начале тестирования'
            : 'Введите все слова, которые помните. Можно писать через пробел или запятую. Учитываются только точные совпадения слов.'}
        </p>
        <textarea className="w-full rounded-xl border p-3" rows={4} value={textInput} onChange={(e) => setTextInput(e.target.value)} placeholder="Введите слова" />
        <Button
          type="submit"
          className="w-full rounded-2xl py-4 text-[1.0625rem] font-bold leading-snug sm:rounded-3xl sm:py-[1.125rem] sm:text-xl"
        >
          Продолжить
        </Button>
      </form>,
    );
  }

  if (app.stage === 'flanker-instruction') {
    return wrapWithTestProgress(
      app.stage,
      <TestInstruction
        title="Задание 2: фланкер"
        text={
          'Сейчас на экране будут появляться пять стрелок в ряд.\n' +
          'Ваша задача — смотреть только на среднюю стрелку и нажимать ту кнопку, куда показывает  средняя стрелка (влево или вправо).\n\n' +
          'Остальные стрелки не важны — даже если они показывают в другую сторону!\n\n' +
          'Правила простые:\n\n' +
          'Нажимайте кнопку «←» (влево) или «→» (вправо) как можно быстрее, но постарайтесь не ошибаться.\n\n' +
          'Всего будет 20 попыток.\n\n' +
          'В одних попытках все стрелки смотрят в одну сторону, в других — по-разному. Но вы всё равно смотрите только на среднюю!\n\n' +
          'У вас есть 2 секунды, чтобы ответить. Если не успели — задание считается невыполненным.'
        }
        onStart={() => app.setStage('flanker')}
      />,
    );
  }

  if (app.stage === 'flanker') {
    if (flanker.done) {
      app.setFlankerTrials(flanker.results);
      app.setStage('reaction-instruction');
      return null;
    }

    return wrapWithTestProgress(
      app.stage,
      <div className="space-y-4 text-center">
        <h2 className="app-heading">Фланкер {flanker.index + 1}/20</h2>
        <ProgressBar value={flanker.index} max={20} />
        <div className="text-5xl font-mono tracking-widest">{flanker.current?.arrows}</div>
        <div className="grid w-full grid-cols-2 gap-3">
          <Button
            type="button"
            className="w-full py-4 text-2xl font-bold sm:py-5 sm:text-3xl"
            onClick={() => flanker.answer('<')}
          >
            ←
          </Button>
          <Button
            type="button"
            className="w-full py-4 text-2xl font-bold sm:py-5 sm:text-3xl"
            onClick={() => flanker.answer('>')}
          >
            →
          </Button>
        </div>
      </div>,
    );
  }

  if (app.stage === 'reaction-instruction') {
    return wrapWithTestProgress(
      app.stage,
      <TestInstruction
        title="Задание 3: Простая сенсомоторная реакция"
        text={
          'В этом задании вам нужно будет как можно быстрее реагировать на появление зелёного круга.\n\n' +
          'Что делать: смотрите на экран. Как только увидите зелёный круг — сразу нажмите в любом месте экрана (пальцем, если на телефоне) или нажмите клавишу Пробел (если за компьютером).\n\n' +
          'Важно: круг появляется не сразу, а через непредсказуемую задержку — от 1 до 3 секунд. Просто ждите, старайтесь не нажимать заранее.\n\n' +
          'Если нажали слишком рано (до появления круга или быстрее, чем за 0,1 секунды после него) — такое нажатие не засчитывается, и круг появится снова. Не переживайте, это нормально.\n\n' +
          'Всего нужно выполнить 30 успешных нажатий (когда вы нажали вовремя). Приложение само отсчитает их и перейдёт дальше.\n\n' +
          'Просто будьте внимательны и старайтесь реагировать быстро, но без спешки. У вас всё получится!'
        }
        onStart={() => app.setStage('reaction')}
      />,
    );
  }

  if (app.stage === 'reaction') {
    return wrapWithTestProgress(
      app.stage,
      <div className="space-y-4 text-center">
        <h2 className="app-heading">Реакция {app.reactionSuccessful.length}/30</h2>
        <ProgressBar value={app.reactionSuccessful.length} max={30} />
        <button
          type="button"
          className={`mx-auto flex h-40 w-40 items-center justify-center rounded-full px-3 text-center text-lg font-bold leading-tight text-white shadow-md transition active:scale-[0.98] sm:h-44 sm:w-44 sm:text-xl ${
            isStimulusVisible ? 'bg-green-500 shadow-green-900/25' : 'bg-slate-400 shadow-slate-900/15'
          }`}
          onClick={handleReactionPress}
        >
          {reactionPrompt}
        </button>
        <p>Слишком ранние нажатия: {app.reactionAnticipations + reaction.anticipations}</p>
      </div>,
    );
  }

  if (app.stage === 'interference-wait') {
    return wrapWithTestProgress(
      app.stage,
      <div className="rounded-xl bg-white p-6 text-center">
        <h2 className="app-heading">Ожидание до отсроченного воспроизведения</h2>
        <p className="text-5xl mt-4">{timer.remainingSec}</p>
      </div>,
    );
  }

  if (app.stage === 'face-study') {
    const f = face.trials[faceStudyIndex];
    return wrapWithTestProgress(
      app.stage,
      <div className="space-y-4">
        <h2 className="app-heading">Задание 4: Лица-имена (изучение)</h2>
        <p className="text-slate-700">
          Изучите лица и соответствующие имена. Постарайтесь запомнить пары «лицо-имя», после отвлекающего задания будет проверка.
        </p>
        <div className="rounded-xl overflow-hidden border-2 border-emerald-900 bg-white">
          <img src={f.image} alt={f.label} className="h-52 w-full object-cover" />
        </div>
        <div className="text-center text-2xl">{f.correctName}</div>
        <div className="flex w-full flex-col gap-3">
          <Button
            type="button"
            variant="secondary"
            className="w-full rounded-2xl py-4 text-[1.0625rem] font-bold leading-snug sm:rounded-3xl sm:py-[1.125rem] sm:text-xl"
            disabled={faceStudyIndex === 0}
            onClick={() => setFaceStudyIndex((v) => v - 1)}
          >
            Назад
          </Button>
          {faceStudyIndex < 2 ? (
            <Button
              type="button"
              className="w-full rounded-2xl py-4 text-[1.0625rem] font-bold leading-snug sm:rounded-3xl sm:py-[1.125rem] sm:text-xl"
              onClick={() => setFaceStudyIndex((v) => v + 1)}
            >
              Далее
            </Button>
          ) : (
            <Button
              type="button"
              className="w-full rounded-2xl py-4 text-[1.0625rem] font-bold leading-snug sm:rounded-3xl sm:py-[1.125rem] sm:text-xl"
              onClick={() => app.setStage('stroop-instruction')}
            >
              Перейти к заданию Струп
            </Button>
          )}
        </div>
      </div>,
    );
  }

  if (app.stage === 'stroop-instruction') {
    return wrapWithTestProgress(
      app.stage,
      <TestInstruction
        title="Задание 4: струп"
        text={
          'На экране появится слово «КРАСНЫЙ», «СИНИЙ» или «ЗЕЛЕНЫЙ», написанное цветными буквами.\n' +
          'Нажимайте кнопку с цветом букв (как окрашено слово), а не по смыслу слова.\n' +
          'Пример: слово «СИНИЙ» красными буквами — правильный ответ «Красный».\n' +
          'Всего 30 проб: 10 совпадающих, 10 конфликтных и 10 нейтральных.\n' +
          'Работайте быстро и точно.'
        }
        onStart={() => app.setStage('stroop-confirm')}
      />,
    );
  }

  if (app.stage === 'stroop-confirm') {
    return wrapWithTestProgress(
      app.stage,
      <StroopConfirmStep
        onConfirm={() => app.setStage('stroop')}
        onBack={() => app.setStage('stroop-instruction')}
      />,
    );
  }

  if (app.stage === 'stroop') {
    if (stroop.done) {
      return wrapWithTestProgress(
        app.stage,
        <p className="text-center text-slate-600">Загрузка следующего задания…</p>,
      );
    }
    const s = stroop.current;
    const colorClass = s?.color === 'red' ? 'text-red-600' : s?.color === 'blue' ? 'text-blue-600' : 'text-green-600';
    const pickColor = (c: 'red' | 'blue' | 'green') => (e: PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      stroop.answer(c);
    };

    return wrapWithTestProgress(
      app.stage,
      <div className="space-y-4 text-center">
        <h2 className="app-heading">Струп {stroop.index + 1}/30</h2>
        <ProgressBar value={stroop.index} max={30} />
        <p className="text-sm text-slate-600">Нажимайте цвет букв, не значение слова</p>
        <div className={`text-4xl font-bold ${colorClass}`}>{s?.word}</div>
        <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3">
          <button
            type="button"
            className="w-full touch-manipulation rounded-2xl bg-red-600 px-4 py-4 text-[1.0625rem] font-bold leading-snug text-white shadow-md transition hover:bg-red-500 active:scale-[0.98] sm:py-[1.125rem] sm:text-xl"
            onPointerDown={pickColor('red')}
          >
            Красный
          </button>
          <button
            type="button"
            className="w-full touch-manipulation rounded-2xl bg-blue-600 px-4 py-4 text-[1.0625rem] font-bold leading-snug text-white shadow-md transition hover:bg-blue-500 active:scale-[0.98] sm:py-[1.125rem] sm:text-xl"
            onPointerDown={pickColor('blue')}
          >
            Синий
          </button>
          <button
            type="button"
            className="w-full touch-manipulation rounded-2xl bg-green-600 px-4 py-4 text-[1.0625rem] font-bold leading-snug text-white shadow-md transition hover:bg-green-500 active:scale-[0.98] sm:py-[1.125rem] sm:text-xl"
            onPointerDown={pickColor('green')}
          >
            Зеленый
          </button>
        </div>
      </div>,
    );
  }

  if (app.stage === 'face-test') {
    return wrapWithTestProgress(
      app.stage,
      <div className="space-y-4">
        <h2 className="app-heading">Задание 5: Проверка лиц-имен</h2>
        <p className="text-slate-700">
          Для каждого лица выберите правильное имя из 3 вариантов. Лица показываются в случайном порядке.
        </p>
        {face.trials.map((f) => (
          <div key={f.id} className="rounded-xl bg-white p-4 space-y-2">
            <img src={f.image} alt={f.label} className="h-40 w-full rounded object-cover border border-slate-300" />
            {f.options.map((name) => (
              <label key={name} className="block">
                <input className="mr-2" type="radio" name={`face-${f.id}`} checked={face.answers[f.id] === name} onChange={() => face.setAnswer(f.id, name)} />
                {name}
              </label>
            ))}
          </div>
        ))}
        <Button
          type="button"
          disabled={!face.isComplete}
          className="w-full rounded-2xl py-4 text-[1.0625rem] font-bold leading-snug sm:rounded-3xl sm:py-[1.125rem] sm:text-xl"
          onClick={finish}
        >
          Завершить анализ
        </Button>
      </div>,
    );
  }

  return null;
};
