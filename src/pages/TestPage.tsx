import { FormEvent, useCallback, useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { BackArrowButton } from '../components/BackArrowButton';
import { CalmCardShell } from '../components/CalmCardShell';
import { Button } from '../components/Button';
import { ProgressBar } from '../components/ProgressBar';
import { StroopConfirmStep } from '../components/StroopConfirmStep';
import { FlankerDirButtonPreview, TestInstruction } from '../components/TestInstruction';
import { TestProgressBanner } from '../components/TestProgressBanner';
import { InterferenceWaitPanel } from '../components/test/InterferenceWaitPanel';
import { useApp } from '../context/AppContext';
import { useFaceNameTest } from '../hooks/useFaceNameTest';
import { useFlankerTest } from '../hooks/useFlankerTest';
import { useReactionTest } from '../hooks/useReactionTest';
import { useStroopTest } from '../hooks/useStroopTest';
import { useTimer } from '../hooks/useTimer';
import { REACTION_TRIAL_COUNT } from '../constants/reactionTest';
import { buildCognitiveAnalytics } from '../utils/cognitiveAnalytics';
import { nextFlankerPrepDelayMs, nextReactionStimulusDelayMs, pickStudyWordList } from '../utils/generateStimuli';
import { buildStatus, normalizeWords, scoreFaceName, scoreFlanker, scoreReaction, scoreStroop, scoreWordMemory } from '../utils/scoring';
import type { AppStage } from '../types';

const INTERFERENCE_MS = 180000;
const WORD_STUDY_MS = 30_000;
const WORD_STUDY_SEC = WORD_STUDY_MS / 1000;

const TEST_STAGES_CENTERED = new Set<AppStage>(['reaction', 'flanker', 'stroop', 'interference-wait']);
/** Контент скроллится внутри, CTA закреплён внизу карточки */
const TEST_STAGES_PIN_FOOTER = new Set<AppStage>(['stroop-confirm']);

function wrapWithTestProgress(stage: AppStage, node: ReactNode, backButton?: ReactNode) {
  return (
    <CalmCardShell fill className="text-white">
      {backButton ? <div className="relative z-50 mb-2 h-11 w-full shrink-0">{backButton}</div> : null}
      <div className="shrink-0">
        <TestProgressBanner stage={stage} />
      </div>
      <div
        className={`flex min-h-0 w-full flex-1 flex-col gap-4 ${
          TEST_STAGES_PIN_FOOTER.has(stage)
            ? 'overflow-hidden'
            : 'overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]'
        } ${TEST_STAGES_CENTERED.has(stage) ? 'justify-center' : 'justify-start pt-1'}`}
      >
        {node}
      </div>
    </CalmCardShell>
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
  const [faceTestIndex, setFaceTestIndex] = useState(0);
  const [finishBusy, setFinishBusy] = useState(false);
  const finishBusyRef = useRef(false);
  const [reactionPrompt, setReactionPrompt] = useState('Ждите сигнал');
  const [isStimulusVisible, setIsStimulusVisible] = useState(false);
  const [attemptTick, setAttemptTick] = useState(0);
  const reactionRecentDelaysRef = useRef<number[]>([]);
  const flankerResponseTimeoutRef = useRef(0);
  const flankerTickIntervalRef = useRef(0);
  const [flankerSecsLeft, setFlankerSecsLeft] = useState(2);

  const deadline = app.interferenceStart ? app.interferenceStart + INTERFERENCE_MS : null;
  const timer = useTimer(deadline);

  const [wordStudyDeadline, setWordStudyDeadline] = useState<number | null>(null);
  const wordStudyTimer = useTimer(wordStudyDeadline);

  useEffect(() => {
    if (app.stage === 'reaction-instruction') {
      reactionRecentDelaysRef.current = [];
    }
  }, [app.stage]);

  const clearFlankerTimers = () => {
    window.clearTimeout(flankerResponseTimeoutRef.current);
    window.clearInterval(flankerTickIntervalRef.current);
    flankerResponseTimeoutRef.current = 0;
    flankerTickIntervalRef.current = 0;
  };

  useEffect(() => {
    if (app.stage !== 'flanker' || flanker.done) return;
    setFlankerSecsLeft(2);
    const prep = nextFlankerPrepDelayMs(app.sessionSeed, flanker.index);
    const startId = window.setTimeout(() => {
      flanker.startTrial();
      setFlankerSecsLeft(2);
      flankerTickIntervalRef.current = window.setInterval(() => {
        setFlankerSecsLeft((s) => Math.max(0, s - 1));
      }, 1000);
      flankerResponseTimeoutRef.current = window.setTimeout(() => {
        clearFlankerTimers();
        flanker.timeout();
      }, 2000);
    }, prep);
    return () => {
      window.clearTimeout(startId);
      clearFlankerTimers();
    };
  }, [app.stage, flanker.index, flanker.done, app.sessionSeed]);

  const answerFlanker = (dir: '<' | '>') => {
    if (!flanker.trialActive) return;
    clearFlankerTimers();
    flanker.answer(dir);
  };

  const stroopAdvanceRef = useRef(false);
  const { setStage, setStroopTrials } = app;
  useEffect(() => {
    if (app.stage !== 'stroop') {
      stroopAdvanceRef.current = false;
      return;
    }
    if (!stroop.done || stroopAdvanceRef.current) return;
    stroopAdvanceRef.current = true;
    setStroopTrials(stroop.results);
    setStage('face-test-instruction');
  }, [app.stage, stroop.done, stroop.results, setStage, setStroopTrials]);

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
    if (app.reactionSuccessful.length < REACTION_TRIAL_COUNT) return;

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

  const finish = useCallback(() => {
    const targets =
      app.studyWordList.length >= 5 ? app.studyWordList : pickStudyWordList(app.sessionSeed);
    const wm = scoreWordMemory(app.immediateWords, app.delayedWords, targets);
    const fl = scoreFlanker(app.flankerTrials);
    const rx = scoreReaction(app.reactionSuccessful, app.reactionAnticipations + reaction.anticipations);
    const st = scoreStroop(app.stroopTrials);

    const mappedAnswers = face.trials.map((trial) => ({
      faceId: trial.id,
      selected: face.answers[trial.id] ?? '',
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
    setStage('result');
  }, [app, face.trials, face.answers, reaction.anticipations, setStage]);

  const runFinish = useCallback(() => {
    const allAnswered = face.trials.every((t) => Boolean(face.answers[t.id]));
    if (finishBusyRef.current || !allAnswered) return;
    finishBusyRef.current = true;
    setFinishBusy(true);
    window.setTimeout(() => {
      try {
        finish();
      } finally {
        finishBusyRef.current = false;
        setFinishBusy(false);
      }
    }, 0);
  }, [face.trials, face.answers, finish]);

  useEffect(() => {
    if (app.stage !== 'word-study') return;
    if (app.studyWordList.length >= 5) return;
    app.setStudyWordList(pickStudyWordList(app.sessionSeed));
  }, [app.stage, app.sessionSeed, app.studyWordList.length]);

  useEffect(() => {
    if (app.stage !== 'word-study') {
      setWordStudyDeadline(null);
      return;
    }
    if (app.studyWordList.length < 5) return;
    setWordStudyDeadline(performance.now() + WORD_STUDY_MS);
  }, [app.stage, app.studyWordList.length]);

  useEffect(() => {
    if (app.stage !== 'word-study' || wordStudyDeadline === null || !wordStudyTimer.isFinished) return;
    app.setStage('word-immediate');
  }, [app.stage, wordStudyDeadline, wordStudyTimer.isFinished, app]);

  if (app.stage === 'word-study') {
    const words = app.studyWordList;
    if (words.length < 5) {
      return wrapWithTestProgress(
        'word-study',
        <div className="calm-inset p-6 calm-body">Подготовка списка слов…</div>,
      );
    }
    return wrapWithTestProgress(
      'word-study',
      <>
        <h2 className="app-heading">Задание 1: Эпизодическая память</h2>
        <div className="calm-inset p-4 space-y-3">
          <p>
            Запомните <strong>5 слов</strong> за <strong>{WORD_STUDY_SEC} секунд</strong>. Когда время закончится, откроется ввод
            слов.
          </p>
          <p className="text-lg font-semibold leading-relaxed text-white sm:text-xl">{words.join(', ')}</p>
          <p className="text-sm calm-body">
            Сначала введёте слова сразу, затем снова — после других заданий (примерно через 3 минуты).
          </p>
          <div className="space-y-2.5 rounded-xl border border-white/15 bg-white/[0.06] px-3 py-3">
            <div className="flex items-center justify-between text-sm font-semibold text-white/80">
              <span>Осталось времени</span>
              <span className="tabular-nums text-2xl font-bold text-teal-300">{wordStudyTimer.remainingSec} с</span>
            </div>
            <ProgressBar value={wordStudyTimer.remainingSec} max={WORD_STUDY_SEC} />
          </div>
        </div>
        <Button
          type="button"
          className="w-full rounded-2xl py-4 text-[1.0625rem] font-bold leading-snug sm:rounded-3xl sm:py-[1.125rem] sm:text-xl"
          onClick={() => app.setStage('word-immediate')}
        >
          Я запомнил(а) — далее
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
        <p className="calm-body">
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
      <TestInstruction title="Задание 2: фланкер" onStart={() => app.setStage('flanker')}>
        <p className="calm-body leading-relaxed">
          Сейчас на экране будут появляться пять стрелок в ряд. Нажимайте кнопку <FlankerDirButtonPreview dir="left" />, если
          средняя стрелка из пяти смотрит <strong className="font-bold text-white">влево</strong> острым углом, и кнопку{' '}
          <FlankerDirButtonPreview dir="right" />, если средняя стрелка из пяти смотрит{' '}
          <strong className="font-bold text-white">вправо</strong> острым углом. На каждую попытку —{' '}
          <strong className="font-bold text-white">2 секунды</strong>; если не успели, попытка засчитывается как пропуск.
        </p>
      </TestInstruction>,
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
        <p className="calm-caption">
          {flanker.trialActive
            ? `Осталось ${flankerSecsLeft} с — нажмите ← или →`
            : 'Приготовьтесь…'}
        </p>
        <div className="grid w-full grid-cols-2 gap-3">
          <Button
            type="button"
            className="w-full py-4 text-2xl font-bold sm:py-5 sm:text-3xl"
            disabled={!flanker.trialActive}
            onClick={() => answerFlanker('<')}
          >
            ←
          </Button>
          <Button
            type="button"
            className="w-full py-4 text-2xl font-bold sm:py-5 sm:text-3xl"
            disabled={!flanker.trialActive}
            onClick={() => answerFlanker('>')}
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
          'Сейчас вам нужно будет как можно быстрее реагировать на появление зеленого круга. Появился зеленый круг - сразу на него нажимайте.'
        }
        onStart={() => app.setStage('reaction')}
      />,
    );
  }

  if (app.stage === 'reaction') {
    return wrapWithTestProgress(
      app.stage,
      <div className="space-y-4 text-center">
        <h2 className="app-heading">
          Реакция {app.reactionSuccessful.length}/{REACTION_TRIAL_COUNT}
        </h2>
        <ProgressBar value={app.reactionSuccessful.length} max={REACTION_TRIAL_COUNT} />
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
      <InterferenceWaitPanel remainingSec={timer.remainingSec} totalSec={INTERFERENCE_MS / 1000} />,
    );
  }

  if (app.stage === 'face-study') {
    const f = face.trials[faceStudyIndex];
    if (!f) {
      return wrapWithTestProgress(
        app.stage,
        <p className="text-center calm-caption">Загрузка задания…</p>,
      );
    }
    return wrapWithTestProgress(
      app.stage,
      <div className="space-y-4">
        <h2 className="app-heading">Задание 4: Лица-имена (изучение)</h2>
        <p className="calm-body">
          Изучите лица и соответствующие имена. Постарайтесь запомнить пары «лицо-имя», после отвлекающего задания будет проверка.
        </p>
        <div className="rounded-xl overflow-hidden border-2 border-emerald-900 bg-white">
          <img src={f.image} alt={f.label} className="h-52 w-full object-cover" />
        </div>
        <div className="text-center text-2xl">{f.correctName}</div>
        <div className="flex w-full flex-col gap-3">
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
      faceStudyIndex > 0 ? (
        <BackArrowButton onClick={() => setFaceStudyIndex((v) => v - 1)} />
      ) : undefined,
    );
  }

  if (app.stage === 'stroop-instruction') {
    return wrapWithTestProgress(
      app.stage,
      <TestInstruction
        title="Задание 4: Струп"
        text="Сейчас на экране поочередно будут появляться слова «КРАСНЫЙ», «СИНИЙ» или «ЗЕЛЕНЫЙ», написанные цветными буквами."
        onStart={() => app.setStage('stroop-confirm')}
      />,
    );
  }

  if (app.stage === 'stroop-confirm') {
    return wrapWithTestProgress(
      app.stage,
      <StroopConfirmStep onConfirm={() => app.setStage('stroop')} />,
    );
  }

  if (app.stage === 'stroop') {
    if (stroop.done) {
      return wrapWithTestProgress(
        app.stage,
        <p className="text-center calm-caption">Загрузка следующего задания…</p>,
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
        <p className="text-sm calm-caption">Нажимайте цвет букв, не значение слова</p>
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

  if (app.stage === 'face-test-instruction') {
    return wrapWithTestProgress(
      app.stage,
      <TestInstruction
        title="Задание 5: Проверка лиц-имен"
        text="Для каждого лица выберите правильное имя из трёх вариантов. Лица будут показываться по одному."
        onStart={() => {
          setFaceTestIndex(0);
          setStage('face-test');
        }}
      />,
    );
  }

  if (app.stage === 'face-test') {
    const f = face.trials[faceTestIndex];
    if (!f) {
      return wrapWithTestProgress(app.stage, <p className="text-center calm-caption">Загрузка…</p>);
    }

    const selected = face.answers[f.id];
    const isLast = faceTestIndex >= face.trials.length - 1;

    const goNextFace = () => {
      if (!selected || finishBusy) return;
      if (isLast) {
        runFinish();
        return;
      }
      setFaceTestIndex((i) => i + 1);
    };

    return wrapWithTestProgress(
      app.stage,
      <div className="flex min-h-0 w-full flex-col gap-4">
        <div className="shrink-0 space-y-2">
          <h2 className="app-heading text-center">
            Лицо {faceTestIndex + 1} из {face.trials.length}
          </h2>
          <ProgressBar value={faceTestIndex + 1} max={face.trials.length} />
        </div>
        <div className="overflow-hidden rounded-2xl border-2 border-white/15 bg-white">
          <img
            src={f.image}
            alt={f.label}
            className="mx-auto h-48 w-full max-w-sm object-cover sm:h-52"
            decoding="async"
          />
        </div>
        <div className="grid gap-3">
          {f.options.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => face.setAnswer(f.id, name)}
              className={`rounded-2xl border-2 px-3 py-4 text-center text-sm font-bold transition ${
                selected === name
                  ? 'border-teal-400/80 bg-teal-500/30 text-white shadow-md ring-2 ring-teal-400/40'
                  : 'border-white/15 bg-white/5 text-white/80 hover:border-white/25 hover:bg-white/10'
              }`}
            >
              {name}
            </button>
          ))}
        </div>
        <div className="mt-auto shrink-0 pt-2">
          <Button
            type="button"
            disabled={!selected || finishBusy}
            className="w-full rounded-2xl py-4 text-[1.0625rem] font-bold leading-snug sm:rounded-3xl sm:py-[1.125rem] sm:text-xl"
            onClick={goNextFace}
          >
            {finishBusy ? 'Считаем результат…' : isLast ? 'Завершить анализ' : 'Далее'}
          </Button>
        </div>
      </div>,
      faceTestIndex > 0 ? (
        <BackArrowButton onClick={() => setFaceTestIndex((i) => i - 1)} aria-label="Назад" />
      ) : undefined,
    );
  }

  return null;
};
