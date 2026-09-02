import React from 'react';

// Minimal line-icon set (stroke-based, currentColor) so every icon in the
// app inherits its color from CSS instead of being a fixed-color emoji.
// Consistent 24x24 viewBox, 1.75 stroke width.

const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round'
};

export function LogoMark({ size = 26 }) {
  // Interconnected nodes -- "connectomic" network mark, doubles as the brand logo.
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <circle cx="6" cy="6" r="2.4" />
      <circle cx="18" cy="6" r="2.4" />
      <circle cx="12" cy="13" r="2.6" />
      <circle cx="6" cy="19" r="2.2" />
      <circle cx="18" cy="19" r="2.2" />
      <line x1="7.7" y1="7.5" x2="10.3" y2="11.2" />
      <line x1="16.3" y1="7.5" x2="13.7" y2="11.2" />
      <line x1="10.4" y1="14.9" x2="7.4" y2="17.4" />
      <line x1="13.6" y1="14.9" x2="16.6" y2="17.4" />
    </svg>
  );
}

export function IconAnatomy(props) { // bone
  return (
    <svg width={28} height={28} viewBox="0 0 24 24" {...base} {...props}>
      <path d="M6.5 4.5a2 2 0 1 1 2.9 2.7l6.4 6.4a2 2 0 1 1 -2.7 2.9l-.1-.1a2 2 0 1 1 -2.9-2.7l-6.4-6.4a2 2 0 1 1 2.8-2.8Z" />
    </svg>
  );
}

export function IconPhysiology(props) { // heart pulse
  return (
    <svg width={28} height={28} viewBox="0 0 24 24" {...base} {...props}>
      <path d="M12 20.2 4.6 12.9a4.6 4.6 0 0 1 6.5-6.5l.9.9.9-.9a4.6 4.6 0 0 1 6.5 6.5L12 20.2Z" />
      <path d="M6.5 12h2.5l1.5-3 2 6 1.5-3H16" />
    </svg>
  );
}

export function IconBiochemistry(props) { // flask
  return (
    <svg width={28} height={28} viewBox="0 0 24 24" {...base} {...props}>
      <path d="M9.5 3.5h5" />
      <path d="M10.2 3.5v5.6L5.6 17a2 2 0 0 0 1.8 3h9.2a2 2 0 0 0 1.8-3l-4.6-7.9V3.5" />
      <path d="M7.5 14.5h9" />
    </svg>
  );
}

export function IconNeuroscience(props) { // brain
  return (
    <svg width={28} height={28} viewBox="0 0 24 24" {...base} {...props}>
      <path d="M9 4.5a2.7 2.7 0 0 0-2.7 2.7 2.5 2.5 0 0 0-1.3 4.4A2.7 2.7 0 0 0 6.5 16a2.7 2.7 0 0 0 2.5 3.5A2 2 0 0 0 11 21V6.7A2.2 2.2 0 0 0 9 4.5Z" />
      <path d="M15 4.5a2.7 2.7 0 0 1 2.7 2.7 2.5 2.5 0 0 1 1.3 4.4A2.7 2.7 0 0 1 17.5 16a2.7 2.7 0 0 1-2.5 3.5A2 2 0 0 1 13 21V6.7a2.2 2.2 0 0 1 2-2.2Z" />
    </svg>
  );
}

export function IconBridge(props) { // suspension bridge -- bridge course
  return (
    <svg width={28} height={28} viewBox="0 0 24 24" {...base} {...props}>
      <path d="M3 16h18" />
      <path d="M3 16v-2.5A9 9 0 0 1 12 5a9 9 0 0 1 9 8.5V16" />
      <path d="M6.5 16v-3.8" /><path d="M9.5 16v-5.6" /><path d="M14.5 16v-5.6" /><path d="M17.5 16v-3.8" />
      <path d="M12 5v11" />
    </svg>
  );
}

export function IconBook(props) {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" {...base} {...props}>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H12v17H6.5A2.5 2.5 0 0 0 4 22.5Z" />
      <path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H12v17h5.5a2.5 2.5 0 0 1 2.5 2.5Z" />
    </svg>
  );
}

export function IconLibrary(props) {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" {...base} {...props}>
      <path d="M4 4v16" /><path d="M9 4v16" />
      <path d="M14.5 4.5 18 20" />
      <path d="M4 4h5" /><path d="M4 20h5" />
    </svg>
  );
}

export function IconDocument(props) {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" {...base} {...props}>
      <path d="M6 3h9l3 3v15H6Z" />
      <path d="M15 3v3h3" />
      <path d="M8.5 12h7" /><path d="M8.5 15.5h7" /><path d="M8.5 8.5h3" />
    </svg>
  );
}

export function IconLink(props) {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" {...base} {...props}>
      <path d="M9.5 14.5 14.5 9.5" />
      <path d="M11 6.5 12.6 4.9a3.2 3.2 0 0 1 4.5 4.5L15.5 11" />
      <path d="M13 17.5 11.4 19.1a3.2 3.2 0 0 1-4.5-4.5L8.5 13" />
    </svg>
  );
}

export function IconPresentation(props) { // ppt
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" {...base} {...props}>
      <rect x="3" y="4" width="18" height="12" rx="1.5" />
      <path d="M8 20h8" /><path d="M12 16v4" />
      <path d="M7 12.5V8l4 2.25L7 12.5Z" />
    </svg>
  );
}

export function IconVideo(props) {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" {...base} {...props}>
      <rect x="3" y="5.5" width="13" height="13" rx="1.5" />
      <path d="M16 10.5 21 7v10l-5-3.5Z" />
    </svg>
  );
}

export function IconGraduate(props) { // faculty
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" {...base} {...props}>
      <path d="M2 9 12 4l10 5-10 5Z" />
      <path d="M6 11.5V16c0 1.7 2.7 3 6 3s6-1.3 6-3v-4.5" />
      <path d="M21 9v6" />
    </svg>
  );
}

export function IconShield(props) { // admin
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" {...base} {...props}>
      <path d="M12 3.5 19 6v6c0 4.5-3 7.5-7 8.5-4-1-7-4-7-8.5V6Z" />
      <path d="M9 12l2 2 4-4.5" />
    </svg>
  );
}

export function IconArrowLeft(props) {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" {...base} {...props}>
      <path d="M19 12H5" /><path d="M11 6l-6 6 6 6" />
    </svg>
  );
}

export function IconArrowRight(props) {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" {...base} {...props}>
      <path d="M5 12h14" /><path d="M13 6l6 6-6 6" />
    </svg>
  );
}

export function IconPlay(props) {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M7 4.5v15l13-7.5Z" />
    </svg>
  );
}

export function IconClose(props) {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" {...base} {...props}>
      <path d="M5 5l14 14" /><path d="M19 5 5 19" />
    </svg>
  );
}

export function IconInfo(props) {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="11" x2="12" y2="16" />
      <circle cx="12" cy="7.5" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconQuiz(props) { // test centre
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" {...base} {...props}>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 8h8" /><path d="M8 12h8" /><path d="M8 16h5" />
      <path d="M8.5 12l1 1 2-2" fill="none" />
    </svg>
  );
}

export function IconChart(props) { // progress
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" {...base} {...props}>
      <path d="M4 20V10" /><path d="M11 20V4" /><path d="M18 20v-7" />
      <path d="M2.5 20.5h19" />
    </svg>
  );
}

export function IconClock(props) {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  );
}

export function IconFmge(props) { // target -- FMGE exam prep
  return (
    <svg width={28} height={28} viewBox="0 0 24 24" {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
    </svg>
  );
}

// Shared lookups so section/book/material icon logic lives in one place.
export const SECTION_ICON_MAP = {
  Anatomy: IconAnatomy,
  Physiology: IconPhysiology,
  Biochemistry: IconBiochemistry,
  Neuroscience: IconNeuroscience
};

export const BOOK_ICON_MAP = {
  bridge: IconBridge,
  mbbs: IconBook,
  reference: IconLibrary,
  fmge: IconFmge
};

// The four top-level site divisions, in display order.
export const LEVELS = [
  { key: 'bridge', label: 'Bridge Course', tagline: 'Foundational content to prepare incoming students.', Icon: IconBridge },
  { key: 'mbbs', label: 'MBBS Level', tagline: 'Core chapter-wise teaching content for the MBBS curriculum.', Icon: IconBook },
  { key: 'reference', label: 'Reference & Postgraduate', tagline: 'Reference books, PPTs, videos and postgraduate-level material.', Icon: IconLibrary },
  { key: 'fmge', label: 'FMGE', tagline: 'Exam-focused high-yield notes, PPTs and question practice.', Icon: IconFmge }
];

export function materialIconFor(type) {
  if (type === 'ppt') return IconPresentation;
  if (type === 'book') return IconLibrary;
  return IconLink;
}