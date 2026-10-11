import {validateReadinessNotes} from './readiness.js';
import {validateEvidence} from './recognition-evidence.js';
import { fields } from './data';
import { cleanExamples } from './recognition';
import {validateTrolleys,createTrolley} from './trolleys.js';
import {validateCorrections} from './reference-library.js';
import {validateMoveHistory} from './trolley-moves.js';
import {validateCollections,validateAssignments} from './collection-sessions.js';

export const defaultFields = [
  ['date', 'Disposal date', 'date'],
  ['description', 'Equipment description', 'text'],
  ['manufacturer', 'Manufacturer', 'text'],
  ['source', 'Taken from', 'text'],
  ['reason', 'Reason for disposal', 'text'],
  ['trolley', 'Caged trolley', 'text'],
];
export const defaultSettings = { speechRate: .92, speechVolume: 1, skipWindow: 700, reuseModel: false, batchModel: '', voiceURI: '', serialFirst: true };
const text = (value, allowEmpty = false) => typeof value === 'string' && (allowEmpty || value.trim().length > 0);
export function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T12:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function validateEquipmentRecord(item,{maxLength=1000}={}) {
  if(!item||!text(item.id)||item.id.length>maxLength||!text(item.technician)||item.technician.length>maxLength||!validDate(item.date))throw Error('Equipment has an invalid ID, technician or disposal date.');
  const clean={id:item.id,technician:item.technician};
  if(item.trolleyId!==undefined){if(!text(item.trolleyId))throw Error('Invalid equipment trolley reference.');clean.trolleyId=item.trolleyId;}
  for(const [key,label] of [...defaultFields,...fields]) {
    if(!text(item[key])||item[key].length>maxLength)throw Error(`Equipment ${label.toLowerCase()} must contain 1 to 1,000 characters.`);
    clean[key]=item[key];
  }
  if(item.readinessNotes!==undefined)clean.readinessNotes=validateReadinessNotes(item.readinessNotes);
  for(const flag of ['recognitionNeedsReview','recognitionConfirmed'])if(item[flag]!==undefined){if(typeof item[flag]!=='boolean')throw Error('Invalid saved recognition review state.');clean[flag]=item[flag];}
  return clean;
}
export function validateWorkspace(value) {
  if (!value || typeof value !== 'object' || !Array.isArray(value.items) ||
      !Array.isArray(value.profiles) || !value.profiles.length ||
      !value.defaults || !value.draft || !Number.isInteger(value.step) || value.step < 0 || value.step > fields.length ||
      typeof value.voice !== 'boolean') throw Error('This file does not contain a valid DecomPro workspace.');
  const codes = new Set();
  const profiles = value.profiles.map(profile => {
    if (!profile || !text(profile.name) || !text(profile.code) || codes.has(profile.code)) throw Error('The backup has invalid technician profiles.');
    codes.add(profile.code);
    return { name: profile.name, code: profile.code };
  });
  if (!codes.has(value.active)) throw Error('The backup has no selected technician.');
  const defaults = {};
  for (const [key] of defaultFields) {
    if (!text(value.defaults[key], true)) throw Error('The backup has invalid batch defaults.');
    defaults[key] = value.defaults[key];
  }
  if (!validDate(defaults.date)) throw Error('The backup has an invalid disposal date.');
  const ids = new Set();
  const items = value.items.map(item => {
    if (!item || !text(item.id) || ids.has(item.id) || !text(item.technician) || !validDate(item.date)) throw Error('The backup has invalid or repeated item IDs or dates.');
    ids.add(item.id);
    const clean = validateEquipmentRecord(item,{maxLength:Infinity});
    return clean;
  });
  const draft = {};
  for (const [key] of fields) {
    if (value.draft[key] !== undefined) {
      if (!text(value.draft[key], true)) throw Error('The backup has invalid captured values.');
      // Older lock logic saved empty current inputs. They are uncaptured fields.
      if (value.draft[key].trim()) draft[key] = value.draft[key];
    }
  }
  if (value.draft.manufacturer !== undefined) {
    if (!text(value.draft.manufacturer, true)) throw Error('Invalid recognized manufacturer.');
    draft.manufacturer = value.draft.manufacturer;
  }
  if(value.draft.recognitionEvidence!==undefined)draft.recognitionEvidence=validateEvidence(value.draft.recognitionEvidence);
  for (const key of ['recognitionNeedsReview','recognitionConfirmed','recognitionCorrected']) {
    if (value.draft[key] !== undefined) {
      if (typeof value.draft[key] !== 'boolean') throw Error('Invalid recognition review state.');
      draft[key] = value.draft[key];
    }
  }
  if (value.captureOrder !== undefined && value.captureOrder !== 'serial-first') throw Error('Unsupported scanning order.');
  const oldFields = [fields[1],fields[0],...fields.slice(2)];
  if ((value.captureOrder ? fields : oldFields).slice(0, value.step).some(([key]) => !draft[key])) throw Error('The backup has inconsistent scanning progress.');
  const step = value.captureOrder ? value.step : value.step === 1 ? 0 : value.step === 0 && draft.serial ? 1 : value.step;
  const settings = { ...defaultSettings };
  if (value.settings !== undefined) {
    const input = value.settings;
    if (!input || typeof input !== 'object' || !Number.isFinite(input.speechRate) || input.speechRate < .6 || input.speechRate > 1.5 ||
        !Number.isFinite(input.speechVolume) || input.speechVolume < 0 || input.speechVolume > 1 ||
        !Number.isInteger(input.skipWindow) || input.skipWindow < 300 || input.skipWindow > 1500 ||
        (input.serialFirst !== undefined && typeof input.serialFirst !== 'boolean') ||
        (input.voiceURI !== undefined && !text(input.voiceURI, true)) ||
        typeof input.reuseModel !== 'boolean' || !text(input.batchModel, true) || (input.reuseModel && !input.batchModel.trim())) {
      throw Error('The workspace has invalid scanner or voice settings.');
    }
    for (const key of Object.keys(defaultSettings)) if (input[key] !== undefined) settings[key] = input[key];
  }
  if (value.referenceExamples !== undefined && !Array.isArray(value.referenceExamples)) throw Error('Invalid recognition catalogue.');
  const referenceExamples = cleanExamples(value.referenceExamples || []);
  const referenceCorrections=validateCorrections(value.referenceCorrections===undefined?[]:value.referenceCorrections);
  settings.serialFirst = true;
  const trolleys=validateTrolleys(value.trolleys||[]);
  if(value.trolleys===undefined) {
   for(const name of new Set([defaults.trolley,...items.map(item=>item.trolley)]))if(name)trolleys.push(createTrolley(name));
   for(const item of items)if(!item.trolleyId)item.trolleyId=trolleys.find(t=>t.name===item.trolley)?.id;
  }
  const activeTrolleyId=value.activeTrolleyId||'';
  if(typeof activeTrolleyId!=='string'||(activeTrolleyId&&!trolleys.some(t=>t.id===activeTrolleyId)))throw Error('The selected trolley is not in this workspace.');
  const trolleyMoves=validateMoveHistory(value.trolleyMoves);
  const collectionSessions=validateCollections(value.collectionSessions),collectionTrolleys=validateAssignments(value.collectionTrolleys,collectionSessions);
  if(collectionTrolleys.some(row=>!trolleys.some(t=>t.id===row.trolleyId)))throw Error('A collection trolley is missing from this workspace.');
  const activeCollectionId=value.activeCollectionId||'',collectionPaused=value.collectionPaused??false,collectionWorkspace=value.collectionWorkspace||'';
  if(typeof activeCollectionId!=='string'||(activeCollectionId&&!collectionSessions.some(row=>row.id===activeCollectionId))||typeof collectionPaused!=='boolean'||typeof collectionWorkspace!=='string'||collectionWorkspace.length>200)throw Error('Invalid active collection session.');
  const collectionScans={};
  if(value.collectionScans!==undefined) {
   if(!value.collectionScans||typeof value.collectionScans!=='object'||Array.isArray(value.collectionScans)||Object.keys(value.collectionScans).length>201)throw Error('Invalid saved collection scans.');
   for(const [id,scan] of Object.entries(value.collectionScans)) {
    if((id!=='unassigned'&&!collectionSessions.some(row=>row.id===id))||!scan||typeof scan!=='object')throw Error('Invalid saved collection scan.');
    const checked=validateWorkspace({...value,...scan,collectionSessions:[],collectionTrolleys:[],collectionScans:undefined,activeCollectionId:'',collectionPaused:false});
    collectionScans[id]={draft:checked.draft,step:checked.step,defaults:checked.defaults,activeTrolleyId:checked.activeTrolleyId};
   }
  }
  return { captureOrder:'serial-first', activeTrolleyId, trolleys, collectionSessions,collectionTrolleys,collectionScans,activeCollectionId,collectionPaused,collectionWorkspace, ...(value.trolleyMoves===undefined?{}:{trolleyMoves}), referenceExamples, referenceCorrections, profiles, active: value.active, defaults, items, draft, step, voice: value.voice, settings };
}
export function parseBackup(contents) {
  const data = JSON.parse(contents);
  if (data?.app !== 'DecomPro' || data.version !== 1) throw Error('Choose a DecomPro JSON backup, version 1.');
  return validateWorkspace(data.state);
}
export function filteredItems(items, query) {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return items.filter(item => {
    const haystack = [...defaultFields, ...fields, ['technician']].map(([key]) => item[key]).join(' ').toLowerCase();
    return terms.every(term => haystack.includes(term));
  }).slice().reverse();
}
