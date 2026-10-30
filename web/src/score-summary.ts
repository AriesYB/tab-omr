import { model } from "@coderline/alphatab";

/** Diagnostic output for the pinned alphaTab version; not the m0 training schema. */
export interface NoteDescription {
  id: string;
  /** 1 is the highest string, matching the project's convention. */
  string: number | null;
  alphaTabString: number;
  fret: number | null;
  midi: number;
  techniques: string[];
  bendPoints: { offset: number; value: number }[];
  relations: Record<string, string | null>;
}

export interface BeatDescription {
  id: string;
  measure: number;
  trackIndex: number;
  staffIndex: number;
  voiceIndex: number;
  eventIndex: number;
  rest: boolean;
  empty: boolean;
  onsetTicks: number;
  playbackOnsetTicks: number;
  duration: {
    notation: string;
    value: number;
    dots: number;
    tuplet: { numerator: number; denominator: number } | null;
    displayTicks: number;
    playbackTicks: number;
  };
  techniques: string[];
  notes: NoteDescription[];
}

export interface ScoreInspection {
  bars: number;
  beats: number;
  notes: number;
  rests: number;
  tempo: number;
  multiVoiceBars: number;
  stringConvention: string;
  tracks: {
    index: number;
    name: string;
    /** First staff for the compact UI; all staves remain available below. */
    tuning: number[];
    capo: number;
    staves: {
      index: number;
      tuning: number[];
      capo: number;
      percussion: boolean;
    }[];
  }[];
  /** Chinese display names. Note effects count notes; beat effects count beats. */
  techniques: Record<string, number>;
  measures: {
    number: number;
    timeSignature: [number, number];
    repeatStart: boolean;
    repeatCount: number;
    events: BeatDescription[];
  }[];
}

function beatAddress(beat: model.Beat): string {
  const bar = beat.voice.bar;
  return `t${bar.staff.track.index + 1}/s${bar.staff.index + 1}/m${bar.index + 1}/v${beat.voice.index + 1}/e${beat.index + 1}`;
}

function noteAddress(note: model.Note | null): string | null {
  return note ? `${beatAddress(note.beat)}/n${note.index + 1}` : null;
}

function noteTechniques(note: model.Note): string[] {
  const result: string[] = [];
  const add = (condition: boolean, label: string) => {
    if (condition) result.push(label);
  };
  add(note.isTieDestination, "延音线");
  add(note.isHammerPullOrigin, "击勾弦");
  add(
    note.slideInType !== model.SlideInType.None ||
      note.slideOutType !== model.SlideOutType.None,
    "滑音",
  );
  add(note.isHarmonic, "泛音");
  add(note.isDead, "死音");
  add(note.isPalmMute, "手掌闷音");
  add(note.isLetRing, "持续发声");
  add(note.isStaccato, "断奏");
  add(note.hasBend, "推弦");
  add(note.vibrato !== model.VibratoType.None, "揉弦");
  add(note.isFingering, "指法标记");
  add(note.isGhost, "幽灵音");
  add(note.isLeftHandTapped, "左手点弦");
  add(note.isTrill, "颤音");
  add(note.accentuated !== model.AccentuationType.None, "重音");
  add(note.ornament !== model.NoteOrnament.None, "装饰奏法");
  return result;
}

function beatTechniques(beat: model.Beat): string[] {
  const result: string[] = [];
  const add = (condition: boolean, label: string) => {
    if (condition) result.push(label);
  };
  add(beat.hasTuplet, "连音组");
  add(beat.graceType !== model.GraceType.None, "装饰音");
  add(beat.brushType !== model.BrushType.None, "扫弦");
  add(beat.tap, "点弦");
  add(beat.slap, "拍弦");
  add(beat.pop, "勾拨");
  add(beat.hasWhammyBar, "摇把");
  add(beat.isTremolo, "震音拨弦");
  add(beat.isLegatoOrigin, "连奏");
  add(beat.deadSlapped, "闷拍");
  add(beat.vibrato !== model.VibratoType.None, "整拍揉弦");
  return result;
}

export function describeBeat(beat: model.Beat): BeatDescription {
  const bar = beat.voice.bar;
  const staff = bar.staff;
  return {
    id: beatAddress(beat),
    measure: bar.index + 1,
    trackIndex: staff.track.index,
    staffIndex: staff.index,
    voiceIndex: beat.voice.index,
    eventIndex: beat.index,
    rest: beat.isRest,
    empty: beat.isEmpty,
    onsetTicks: beat.displayStart,
    playbackOnsetTicks: beat.playbackStart,
    duration: {
      notation: model.Duration[beat.duration],
      value: beat.duration,
      dots: beat.dots,
      tuplet: beat.hasTuplet
        ? {
            numerator: beat.tupletNumerator,
            denominator: beat.tupletDenominator,
          }
        : null,
      displayTicks: beat.displayDuration,
      playbackTicks: beat.playbackDuration,
    },
    techniques: beatTechniques(beat),
    notes: beat.notes.map((note) => ({
      id: noteAddress(note)!,
      string: note.isStringed ? staff.tuning.length + 1 - note.string : null,
      alphaTabString: note.string,
      fret: note.isStringed ? note.fret : null,
      midi: note.realValue,
      techniques: noteTechniques(note),
      bendPoints:
        note.bendPoints?.map((point) => ({
          offset: point.offset,
          value: point.value,
        })) ?? [],
      relations: {
        tieFrom: noteAddress(note.tieOrigin),
        tieTo: noteAddress(note.tieDestination),
        hammerPullFrom: noteAddress(note.hammerPullOrigin),
        hammerPullTo: noteAddress(note.hammerPullDestination),
        slideFrom: noteAddress(note.slideOrigin),
        slideTo: noteAddress(note.slideTarget),
        slurFrom: noteAddress(note.slurOrigin),
        slurTo: noteAddress(note.slurDestination),
      },
    })),
  };
}

export function inspectScore(score: model.Score): ScoreInspection {
  const summary: ScoreInspection = {
    bars: score.masterBars.length,
    beats: 0,
    notes: 0,
    rests: 0,
    tempo: score.tempo,
    multiVoiceBars: 0,
    stringConvention:
      "string=1 为最高音弦；调弦 MIDI 数组按高音到低音排列。所有时间刻度均为 alphaTab 的 MIDI ticks。",
    tracks: score.tracks.map((track) => ({
      index: track.index,
      name: track.name,
      tuning: [...(track.staves[0]?.tuning ?? [])],
      capo: track.staves[0]?.capo ?? 0,
      staves: track.staves.map((staff) => ({
        index: staff.index,
        tuning: [...staff.tuning],
        capo: staff.capo,
        percussion: staff.isPercussion,
      })),
    })),
    techniques: {},
    measures: score.masterBars.map((bar) => ({
      number: bar.index + 1,
      timeSignature: [bar.timeSignatureNumerator, bar.timeSignatureDenominator],
      repeatStart: bar.isRepeatStart,
      repeatCount: bar.repeatCount,
      events: [],
    })),
  };
  const multipleVoiceMeasureNumbers = new Set<number>();
  const count = (label: string) => {
    summary.techniques[label] = (summary.techniques[label] ?? 0) + 1;
  };
  for (const track of score.tracks)
    for (const staff of track.staves)
      for (const bar of staff.bars) {
        const activeVoices = bar.voices.filter((voice) => !voice.isEmpty);
        if (activeVoices.length > 1) multipleVoiceMeasureNumbers.add(bar.index);
        for (const voice of activeVoices)
          for (const beat of voice.beats) {
            if (beat.isEmpty) continue;
            const description = describeBeat(beat);
            summary.beats++;
            summary.notes += beat.notes.length;
            if (beat.isRest) summary.rests++;
            description.techniques.forEach(count);
            description.notes.forEach((note) => note.techniques.forEach(count));
            summary.measures[bar.index].events.push(description);
          }
      }
  summary.multiVoiceBars = multipleVoiceMeasureNumbers.size;
  return summary;
}
