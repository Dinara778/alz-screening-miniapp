import { FormEvent, useEffect, useState } from 'react';
import { Button } from '../components/Button';
import { ProgressBar } from '../components/ProgressBar';
import { TestInstruction } from '../components/TestInstruction';
import { useApp } from '../context/AppContext';
import { useFaceNameTest } from '../hooks/useFaceNameTest';
import { useFlankerTest } from '../hooks/useFlankerTest';
import { useReactionTest } from '../hooks/useReactionTest';
import { useStroopTest } from '../hooks/useStroopTest';
import { useTimer } from '../hooks/useTimer';
import { WORDS } from '../utils/generateStimuli';
import { buildStatus, normalizeWords, scoreFaceName, scoreFlanker, scoreReaction, scoreStroop, scoreWordMemory } from '../utils/scoring';

const INTERFERENCE_MS = 180000;

export const TestPage = () => {
  const app = useApp();
  const flanker = useFlankerTest();
  const reaction = useReactionTest();
  const stroop = useStroopTest();
  const face = useFaceNameTest();

  const [textInput, setTextInput] = useState('');
  const [faceStudyIndex, setFaceStudyIndex] = useState(0);
  const [reactionPrompt, setReactionPrompt] = useState('Ждите сигнал');
  const [isStimulusVisible, setIsStimulusVisible] = useState(false);
  const [attemptTick, setAttemptTick] = useState(0);

  const deadline = app.interferenceStart ? app.interferenceStart + INTERFERENCE_MS : null;
  const timer = useTimer(deadline);

  useEffect(() => {
    if (app.stage !== 'flanker' || flanker.done) return;
    let timeoutId = 0;
    const startId = window.setTimeout(() => {
      flanker.startTrial();
      timeoutId = window.setTimeout(() => flanker.timeout(), 2000);
    }, 500);
    return () => {
      window.clearTimeout(startId);
      window.clearTimeout(timeoutId);
    };
  }, [app.stage, flanker.index, flanker.done]);

  useEffect(() => {
    if (app.stage !== 'stroop' || stroop.done) return;
    stroop.startTrial();
  }, [app.stage, stroop.index, stroop.done]);

  useEffect(() => {
    if (app.stage === 'interference-wait' && timer.isFinished) {
      app.setStage('word-delayed');
    }
  }, [app.stage, timer.isFinished]);

  useEffect(() => {
    if (app.stage !== 'reaction' || reaction.isDone) return;
    setIsStimulusVisible(false);
    setReactionPrompt('Ждите сигнал');

    const delay = 1000 + Math.random() * 2000;
    const startId = window.setTimeout(() => {
      setIsStimulusVisible(true);
      reaction.registerStimulus();
      setReactionPrompt('ЖМИТЕ!');
    }, delay);

    return () => window.clearTimeout(startId);
  }, [app.stage, attemptTick, reaction.isDone]);

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
      setReactionPrompt('Антиципация (<100 мс), повтор');
      setAttemptTick((v) => v + 1);
      return;
    }

    if (outcome.status === 'success') {
      app.setReactionSuccessful([...app.reactionSuccessful, outcome.rt ?? 0]);
      setReactionPrompt(`RT: ${Math.round(outcome.rt ?? 0)} мс`);
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
    const wm = scoreWordMemory(app.immediateWords, app.delayedWords);
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

    const flags = [wm.redFlag, fl.redFlag, rx.redFlag, st.redFlag, fn.redFlag].filter(Boolean).length;

    app.saveResult({
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      flags,
      status: buildStatus(flags),
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

  if (app.stage === 'word-study') {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Задание 1: Эпизодическая память</h2>
        <div className="rounded-xl bg-white p-4 space-y-2">
          <p>Сейчас вы увидите 5 слов. Ваша задача - внимательно их запомнить.</p>
          <p className="font-semibold">Слова: {WORDS.join(', ')}</p>
          <p className="text-sm text-slate-700">
            Через несколько секунд нужно будет воспроизвести слова сразу, а затем повторить их после серии других заданий
            (примерно через 3 минуты).
          </p>
        </div>
        <Button onClick={() => app.setStage('word-immediate')}>Я запомнил(а)</Button>
      </div>
    );
  }

  if (app.stage === 'word-immediate' || app.stage === 'word-delayed') {
    const delayed = app.stage === 'word-delayed';
    return (
      <form className="space-y-4" onSubmit={(e) => submitWords(e, delayed)}>
        <h2 className="text-2xl font-bold">{delayed ? 'Отсроченное воспроизведение' : 'Немедленное воспроизведение'}</h2>
        <p className="text-slate-700">
          {delayed
            ? 'По истчении времени вам нужно написать 5 слов, которые вы запомнили в начале тестирования.'
            : 'Введите все слова, которые помните. Можно писать через пробел или запятую. Учитываются только точные совпадения слов.'}
        </p>
        <textarea className="w-full rounded-xl border p-3" rows={4} value={textInput} onChange={(e) => setTextInput(e.target.value)} placeholder="Введите слова" />
        <Button type="submit">Продолжить</Button>
      </form>
    );
  }

  if (app.stage === 'flanker-instruction') {
    return (
      <TestInstruction
        title="Задание 2: Flanker"
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
      />
    );
  }

  if (app.stage === 'flanker') {
    if (flanker.done) {
      app.setFlankerTrials(flanker.results);
      app.setStage('reaction-instruction');
      return null;
    }

    return (
      <div className="space-y-4 text-center">
        <h2 className="text-xl font-bold">Flanker {flanker.index + 1}/20</h2>
        <ProgressBar value={flanker.index} max={20} />
        <div className="text-5xl font-mono tracking-widest">{flanker.current?.arrows}</div>
        <div className="flex justify-center gap-3">
          <Button onClick={() => flanker.answer('<')}>←</Button>
          <Button onClick={() => flanker.answer('>')}>→</Button>
        </div>
      </div>
    );
  }

  if (app.stage === 'reaction-instruction') {
    return (
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
      />
    );
  }

  if (app.stage === 'reaction') {
    return (
      <div className="space-y-4 text-center">
        <h2 className="text-xl font-bold">Реакция {app.reactionSuccessful.length}/30</h2>
        <ProgressBar value={app.reactionSuccessful.length} max={30} />
        <button className={`mx-auto h-40 w-40 rounded-full text-white font-bold ${isStimulusVisible ? 'bg-green-500' : 'bg-slate-400'}`} onClick={handleReactionPress}>
          {reactionPrompt}
        </button>
        <p>Антиципации: {app.reactionAnticipations + reaction.anticipations}</p>
      </div>
    );
  }

  if (app.stage === 'interference-wait') {
    return (
      <div className="rounded-xl bg-white p-6 text-center">
        <h2 className="text-2xl font-bold">Ожидание до отсроченного воспроизведения</h2>
        <p className="text-5xl mt-4">{timer.remainingSec}</p>
      </div>
    );
  }

  if (app.stage === 'face-study') {
    const f = face.trials[faceStudyIndex];
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Задание 5: Лица-имена (изучение)</h2>
        <p className="text-slate-700">
          Изучите лица и соответствующие имена. Постарайтесь запомнить пары «лицо-имя», после отвлекающего задания будет проверка.
        </p>
        <div className="rounded-xl overflow-hidden border-2 border-emerald-900 bg-white">
          <img src={f.image} alt={f.label} className="h-52 w-full object-cover" />
        </div>
        <div className="text-center text-2xl">{f.correctName}</div>
        <div className="flex gap-3">
          <Button variant="secondary" disabled={faceStudyIndex === 0} onClick={() => setFaceStudyIndex((v) => v - 1)}>Назад</Button>
          {faceStudyIndex < 2 ? (
            <Button onClick={() => setFaceStudyIndex((v) => v + 1)}>Далее</Button>
          ) : (
            <Button onClick={() => app.setStage('stroop-instruction')}>Перейти к Stroop</Button>
          )}
        </div>
      </div>
    );
  }

  if (app.stage === 'stroop-instruction') {
    return (
      <TestInstruction
        title="Задание 4: Stroop"
        text={
          'На экране будет отображаться слово цвета (например, КРАСНЫЙ, СИНИЙ, ЗЕЛЕНЫЙ), окрашенное в один из цветов.\n' +
          'Ваша задача: выбрать ЦВЕТ ШРИФТА, а не прочитанное слово.\n' +
          'Используйте кнопки Красный / Синий / Зеленый.\n' +
          'Всего 30 проб: 10 конгруэнтных, 10 неконгруэнтных и 10 нейтральных.\n' +
          'Работайте максимально быстро и точно.'
        }
        onStart={() => app.setStage('stroop')}
      />
    );
  }

  if (app.stage === 'stroop') {
    if (stroop.done) {
      app.setStroopTrials(stroop.results);
      app.setStage('face-test');
      return null;
    }
    const s = stroop.current;
    const colorClass = s?.color === 'red' ? 'text-red-600' : s?.color === 'blue' ? 'text-blue-600' : 'text-green-600';

    return (
      <div className="space-y-4 text-center">
        <h2 className="text-xl font-bold">Stroop {stroop.index + 1}/30</h2>
        <ProgressBar value={stroop.index} max={30} />
        <div className={`text-4xl font-bold ${colorClass}`}>{s?.word}</div>
        <div className="grid grid-cols-3 gap-2">
          <Button className="!bg-red-700 !text-white hover:!bg-red-600" onClick={() => stroop.answer('red')}>Красный</Button>
          <Button className="!bg-blue-700 !text-white hover:!bg-blue-600" onClick={() => stroop.answer('blue')}>Синий</Button>
          <Button className="!bg-green-700 !text-white hover:!bg-green-600" onClick={() => stroop.answer('green')}>Зеленый</Button>
        </div>
      </div>
    );
  }

  if (app.stage === 'face-test') {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Тестирование лиц-имен</h2>
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
        <Button disabled={!face.isComplete} onClick={finish}>Завершить скрининг</Button>
      </div>
    );
  }

  return null;
};
