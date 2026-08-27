import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import HillVideoModal from '../components/HillVideoModal.jsx';
import { IconAnatomy, IconPhysiology, IconBiochemistry, IconNeuroscience, IconArrowRight, IconPlay, LEVELS } from '../components/Icons.jsx';

const CDN = 'https://pub-f4f030961eab45ada12b3d35525b2379.r2.dev';
const HILLS = [
  { label: '1 · Known → Unknown', url: `${CDN}/The First Hill.mp4` },
  { label: '2 · Central Point', url: `${CDN}/The Second Hill.mp4` },
  { label: '3 · Let Student Discover', url: `${CDN}/The Third Hill.mp4` },
  { label: '4 · One Key, Many Doors', url: `${CDN}/The Fourth Hill.mp4` },
  { label: '5 · Recognise Patterns', url: `${CDN}/The Fifth Hill.mp4` },
  { label: '6 · Build Connections', url: `${CDN}/The Sixth Hill.mp4` },
  { label: '7 · Real-World Wisdom', url: `${CDN}/The Seventh Hill.mp4` }
];

const SECTIONS = [
  { Icon: IconAnatomy, name: 'Anatomy' },
  { Icon: IconPhysiology, name: 'Physiology' },
  { Icon: IconBiochemistry, name: 'Biochemistry' },
  { Icon: IconNeuroscience, name: 'Neuroscience' }
];

export default function Welcome() {
  const [activeVideo, setActiveVideo] = useState(null);

  return (
    <div className="page hero">
      <div className="eyebrow">Connectomic Medical Academy</div>
      <h1>Anatomy · Physiology · Biochemistry · Neuroscience</h1>
      <p className="lead">
        A connected, chapter-by-chapter path through pre-clinical MBBS subjects — built around
        Prof. Konuri's Seven Hills of Knowledge. Each section pairs a core MBBS-level track with
        a full reference library: reference book material, PPTs and videos.
      </p>

      <div className="ridge" aria-hidden="true">
        <svg viewBox="0 0 920 190" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M0,190 L0,120 Q120,50 240,110 T460,90 T680,120 T920,80 L920,190 Z" fill="var(--hill-7)" />
          <path d="M0,190 L0,150 Q160,90 320,140 T620,120 T920,140 L920,190 Z" fill="var(--hill-5)" />
          <path d="M0,190 L0,165 Q200,120 400,160 T800,150 T920,165 L920,190 Z" fill="var(--hill-3)" />
          <path d="M0,190 L0,178 Q260,150 460,178 T920,178 L920,190 Z" fill="var(--hill-2)" />
        </svg>
      </div>

      <div className="grid-7 mt-1">
        {HILLS.map((h, i) => (
          <div key={i} className="badge badge-hill" onClick={() => setActiveVideo(h)}>
            <span className="badge-hill-play"><IconPlay /></span>{h.label}
          </div>
        ))}
      </div>

      <Link to="/register" className="btn btn-primary mt-2">Start Your Journey <IconArrowRight /></Link>

      <div className="eyebrow mt-2" style={{ marginTop: '2rem' }}>Three Levels, Organized Separately</div>
      <p className="helper-text" style={{ maxWidth: 640, margin: '0 auto' }}>
        Everything on the academy lives under one of three independent divisions -- each with its
        own subjects, books, chapters and faculty uploads.
      </p>
      <div className="grid-3 mt-1" style={{ maxWidth: 1080, margin: '0.5rem auto 0' }}>
        {LEVELS.map(({ key, label, tagline, Icon }) => (
          <Link key={key} to="/register" className={`card level-card level-card-${key}`} style={{ color: 'inherit' }}>
            <Icon className="level-card-icon" />
            <h3>{label}</h3>
            <p className="helper-text">{tagline}</p>
          </Link>
        ))}
      </div>

      <div className="eyebrow mt-2" style={{ marginTop: '2rem' }}>The Four Sections</div>
      <div className="grid-4" style={{ textAlign: 'center', maxWidth: 1080, margin: '0.5rem auto 0' }}>
        {SECTIONS.map(({ Icon, name }) => (
          <div key={name} className="card section-icon-card">
            <Icon className="section-icon" />
            <h3>{name}</h3>
            <p className="helper-text">Bridge, MBBS &amp; Reference/PG content for every subject.</p>
          </div>
        ))}
      </div>

      <HillVideoModal video={activeVideo} onClose={() => setActiveVideo(null)} />
    </div>
  );
}
