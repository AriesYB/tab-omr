#!/usr/bin/env node
// Local diagnostic only: alphaTab's JSON is version-bound, not our training schema.
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as alphaTab from '../web/node_modules/@coderline/alphatab/dist/alphaTab.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
let inputDirectory = path.join(root, 'gps');
let output;
for (let index = 0; index < args.length; index++) {
  if (args[index] === '--output' && args[index + 1]) output = path.resolve(args[++index]);
  else if (args[index] === '--input' && args[index + 1]) inputDirectory = path.resolve(args[++index]);
  else throw new Error(`Unknown or incomplete argument: ${args[index]}`);
}

const { version } = JSON.parse(await readFile(path.join(root, 'web/node_modules/@coderline/alphatab/package.json'), 'utf8'));
const settings = new alphaTab.Settings();
const noteFields = [
  'string', 'fret', 'realValue', 'isVisible', 'accentuated', 'bendType', 'bendStyle',
  'isContinuedBend', 'isLeftHandTapped', 'isHammerPullOrigin', 'isHammerPullDestination',
  'isSlurOrigin', 'isSlurDestination', 'harmonicType', 'harmonicValue', 'isGhost',
  'isLetRing', 'isPalmMute', 'isDead', 'isStaccato', 'slideInType', 'slideOutType',
  'vibrato', 'isTieDestination', 'isTieOrigin', 'leftHandFinger', 'rightHandFinger',
  'trillValue', 'trillSpeed', 'durationPercent', 'dynamics', 'ornament',
];
const beatFields = [
  'duration', 'dots', 'isRest', 'isFullBarRest', 'tupletNumerator', 'tupletDenominator',
  'displayStart', 'displayDuration', 'playbackStart', 'playbackDuration',
  'graceType', 'isLegatoOrigin', 'isLegatoDestination', 'fade', 'pop', 'slap', 'tap',
  'slashed', 'deadSlapped', 'brushType', 'brushDuration', 'whammyStyle', 'whammyBarType',
  'isContinuedWhammy', 'vibrato', 'pickStroke', 'crescendo', 'golpe', 'dynamics',
  'wahPedal', 'barreFret', 'barreShape', 'rasgueado', 'ottava',
];

function fields(object, names) {
  return Object.fromEntries(names.map(name => [name, object[name] ?? null]));
}

function points(values) {
  return values?.map(point => ({ offset: point.offset, value: point.value })) ?? [];
}

function automation(automations) {
  return automations.map(value => fields(value, ['type', 'value', 'ratioPosition', 'isLinear']));
}

// Ignore generated IDs and engraving-only details. Include resolved relationships
// by structural address, so a repeated GPIF note definition counts at every use.
function semanticSnapshot(score) {
  const addresses = new Map();
  for (const [ti, track] of score.tracks.entries()) {
    for (const [si, staff] of track.staves.entries()) {
      for (const [mi, bar] of staff.bars.entries()) {
        for (const [vi, voice] of bar.voices.entries()) {
          for (const [bi, beat] of voice.beats.entries()) {
            for (const [ni, note] of beat.notes.entries()) {
              addresses.set(note, `${ti}/${si}/${mi}/${vi}/${bi}/${ni}`);
            }
          }
        }
      }
    }
  }
  return {
    masterBars: score.masterBars.map(bar => ({
      ...fields(bar, ['timeSignatureNumerator', 'timeSignatureDenominator', 'isRepeatStart',
        'repeatCount', 'alternateEndings', 'tripletFeel', 'isFreeTime', 'isAnacrusis']),
      tempoAutomations: automation(bar.tempoAutomations),
    })),
    tracks: score.tracks.map(track => ({
      staves: track.staves.map(staff => ({
        tuning: staff.tuning,
        ...fields(staff, ['capo', 'transpositionPitch', 'isPercussion']),
        bars: staff.bars.map(bar => ({
          voices: bar.voices.filter(voice => !voice.isEmpty).map(voice => ({
            beats: voice.beats.filter(beat => !beat.isEmpty).map(beat => ({
              ...fields(beat, beatFields),
              whammyBarPoints: points(beat.whammyBarPoints),
              tremoloPicking: beat.tremoloPicking ? {
                marks: beat.tremoloPicking.marks,
                speed: beat.tremoloPicking.speed,
              } : null,
              automations: automation(beat.automations),
              notes: beat.notes.map(note => ({
                ...fields(note, noteFields),
                bendPoints: points(note.bendPoints),
                relations: Object.fromEntries([
                  'tieOrigin', 'tieDestination', 'hammerPullOrigin', 'hammerPullDestination',
                  'slideOrigin', 'slideTarget', 'slurOrigin', 'slurDestination',
                ].map(name => [name, note[name] ? addresses.get(note[name]) ?? 'unresolved' : null])),
              })),
            })),
          })),
        })),
      })),
    })),
  };
}

function differences(before, after, location = '$', result = []) {
  if (Object.is(before, after)) return result;
  if (before && after && typeof before === 'object' && typeof after === 'object') {
    for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
      differences(before[key], after[key], `${location}.${key}`, result);
    }
  } else result.push({ path: location, before: before ?? null, after: after ?? null });
  return result;
}

function summarize(score) {
  let beats = 0, notes = 0, rests = 0, voiceMeasures = 0, multiVoiceMeasures = 0;
  const durations = {}, techniques = {};
  const count = (name, active) => { if (active) techniques[name] = (techniques[name] ?? 0) + 1; };
  const tracks = score.tracks.map(track => ({
    name: track.name,
    staves: track.staves.map(staff => {
      for (const bar of staff.bars) {
        const active = bar.voices.filter(voice => !voice.isEmpty);
        voiceMeasures += active.length;
        if (active.length > 1) multiVoiceMeasures++;
        for (const voice of active) for (const beat of voice.beats) {
          if (beat.isEmpty) continue;
          beats++;
          if (beat.isRest) rests++;
          const duration = `${beat.duration}${'.'.repeat(beat.dots)}`;
          durations[duration] = (durations[duration] ?? 0) + 1;
          count('tupletBeats', beat.hasTuplet);
          count('graceBeats', beat.graceType !== 0);
          count('brushBeats', beat.brushType !== 0);
          count('tapBeats', beat.tap);
          count('slapBeats', beat.slap);
          count('popBeats', beat.pop);
          count('whammyBeats', beat.hasWhammyBar);
          for (const note of beat.notes) {
            notes++;
            count('tieDestinations', note.isTieDestination);
            count('hammerPullOrigins', note.isHammerPullOrigin);
            count('slides', note.slideInType !== 0 || note.slideOutType !== 0);
            count('harmonics', note.isHarmonic);
            count('deadNotes', note.isDead);
            count('palmMutes', note.isPalmMute);
            count('letRings', note.isLetRing);
            count('staccatos', note.isStaccato);
            count('bends', note.hasBend);
            count('vibratos', note.vibrato !== 0);
            count('fingerings', note.isFingering);
          }
        }
      }
      return { tuningHighToLowMidi: staff.tuning, capo: staff.capo, bars: staff.bars.length };
    }),
  }));
  return {
    title: score.title, tempo: score.tempo, measures: score.masterBars.length,
    tracks, voiceMeasures, multiVoiceMeasures, beats, rests, noteOccurrences: notes,
    durationDenominatorsWithDots: durations, techniques,
  };
}

const files = (await readdir(inputDirectory)).filter(file => /\.gp[345x]?$/i.test(file)).sort();
if (!files.length) throw new Error(`No GP files found in ${inputDirectory}`);
const report = {
  alphaTabVersion: version,
  scope: 'Imported alphaTab model; this does not establish fidelity against Guitar Pro itself or audio realism.',
  jsonScope: 'alphaTab diagnostic JSON is only supported with this pinned version; it is not the m0 training schema.',
  stringConvention: 'alphaTab note.string=1 is lowest; canonical m0 string=1 is highest. Convert with stringCount + 1 - note.string.',
  checks: { noteFields, beatFields, resolvedRelations: true, tempoTuningCapoTimeSignatureAndRepeats: true },
  files: [],
};
let failed = false;
for (const file of files) {
  try {
    const score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(new Uint8Array(await readFile(path.join(inputDirectory, file))), settings);
    const before = semanticSnapshot(score);
    const gp = new alphaTab.exporter.Gp7Exporter().export(score, settings);
    const gpAfter = alphaTab.importer.ScoreLoader.loadScoreFromBytes(gp, settings);
    const json = alphaTab.model.JsonConverter.scoreToJson(score);
    const jsonAfter = alphaTab.model.JsonConverter.jsonToScore(json, settings);
    const gpDiff = differences(before, semanticSnapshot(gpAfter));
    const jsonDiff = differences(before, semanticSnapshot(jsonAfter));
    failed ||= gpDiff.length > 0 || jsonDiff.length > 0;
    const entry = {
      file, ...summarize(score),
      gpRoundTrip: { passed: gpDiff.length === 0, differenceCount: gpDiff.length, differences: gpDiff.slice(0, 30), bytes: gp.length },
      jsonRoundTrip: { passed: jsonDiff.length === 0, differenceCount: jsonDiff.length, differences: jsonDiff.slice(0, 30) },
    };
    report.files.push(entry);
    console.log(`${file}: ${entry.measures} bars, ${entry.beats} beats, ${entry.noteOccurrences} note occurrences; GP ${gpDiff.length ? `FAIL (${gpDiff.length})` : 'OK'}, JSON ${jsonDiff.length ? `FAIL (${jsonDiff.length})` : 'OK'}`);
  } catch (error) {
    failed = true;
    report.files.push({ file, error: error.stack ?? String(error) });
    console.error(`${file}: ${error.message}`);
  }
}
report.passed = !failed;
report.totals = report.files.reduce((totals, file) => ({
  files: totals.files + 1,
  measures: totals.measures + (file.measures ?? 0),
  beats: totals.beats + (file.beats ?? 0),
  noteOccurrences: totals.noteOccurrences + (file.noteOccurrences ?? 0),
}), { files: 0, measures: 0, beats: 0, noteOccurrences: 0 });
if (output) {
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Report: ${output}`);
}
console.log(`Total: ${report.totals.files} files, ${report.totals.measures} bars, ${report.totals.noteOccurrences} note occurrences. ${failed ? 'Round-trip differences found.' : 'All round-trip checks passed.'}`);
if (failed) process.exitCode = 1;
