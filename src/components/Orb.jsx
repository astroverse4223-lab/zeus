import React from 'react';

const CSS = `
@keyframes orb-pulse       { 0%,100%{transform:scale(1);opacity:.75} 50%{transform:scale(1.07);opacity:1} }
@keyframes orb-pulse-fast  { 0%,100%{transform:scale(1);opacity:.85} 50%{transform:scale(1.13);opacity:1} }
@keyframes orb-ring-1      { 0%,100%{transform:scale(1);opacity:.45} 50%{transform:scale(1.05);opacity:.12} }
@keyframes orb-ring-2      { 0%,100%{transform:scale(1);opacity:.28} 50%{transform:scale(1.09);opacity:.06} }
@keyframes orb-ring-3      { 0%,100%{transform:scale(1);opacity:.16} 50%{transform:scale(1.14);opacity:.03} }
@keyframes orb-spin        { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
@keyframes orb-spin-rev    { from{transform:rotate(0deg)} to{transform:rotate(-360deg)} }
@keyframes orb-scan        { 0%{top:-4px;opacity:0} 20%{opacity:.5} 80%{opacity:.5} 100%{top:100%;opacity:0} }
`;

export default function Orb({ size = 120, active = false, speaking = false }) {
  const c = size * 0.56;
  // "speaking" is the most energized state — it implies active visuals plus a warm tint
  // and faster motion so the orb visibly "talks".
  const hot = active || speaking;
  return (
    <>
      <style>{CSS}</style>
      <div style={{ position: 'relative', width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>

        {/* Outer rings */}
        {[
          { scale: 1.38, a: 'orb-ring-1', d: hot ? (speaking ? '0.7s' : '1s')   : '3.2s', dl: '0s'   },
          { scale: 1.68, a: 'orb-ring-2', d: hot ? (speaking ? '0.9s' : '1.3s') : '4.3s', dl: '0.35s'},
          { scale: 2.0,  a: 'orb-ring-3', d: hot ? (speaking ? '1.1s' : '1.6s') : '5.5s', dl: '0.65s'},
        ].map((r, i) => (
          <div key={i} style={{
            position: 'absolute',
            width: c * r.scale, height: c * r.scale,
            borderRadius: '50%',
            border: `1px solid ${speaking ? `rgba(110,231,183,${0.5})` : `rgba(0,212,255,${hot ? 0.45 : 0.18})`}`,
            animation: `${r.a} ${r.d} ease-in-out infinite ${r.dl}`,
            transition: 'border-color 0.6s',
          }} />
        ))}

        {/* Rotating dashed rings */}
        <div style={{
          position: 'absolute', width: c * 1.12, height: c * 1.12, borderRadius: '50%',
          border: `1px dashed rgba(0,212,255,${hot ? 0.28 : 0.1})`,
          animation: `orb-spin ${hot ? (speaking ? '2.5s' : '4s') : '14s'} linear infinite`,
        }} />
        <div style={{
          position: 'absolute', width: c * 0.87, height: c * 0.87, borderRadius: '50%',
          border: `1px dashed rgba(0,212,255,${hot ? 0.18 : 0.07})`,
          animation: `orb-spin-rev ${hot ? (speaking ? '3.5s' : '6s') : '20s'} linear infinite`,
        }} />

        {/* Core sphere */}
        <div style={{
          position: 'relative', width: c, height: c, borderRadius: '50%',
          background: speaking
            ? 'radial-gradient(circle at 30% 28%, #7df5c8, #0fb88a, #013026)'
            : hot
              ? 'radial-gradient(circle at 30% 28%, #4df0ff, #009fdd, #001833)'
              : 'radial-gradient(circle at 30% 28%, #00b8d9, #003d66, #000d1a)',
          boxShadow: speaking
            ? `0 0 ${size*.42}px rgba(16,222,150,.6), 0 0 ${size*.18}px rgba(16,222,150,.85), inset 0 0 ${size*.14}px rgba(16,222,150,.25)`
            : hot
              ? `0 0 ${size*.38}px rgba(0,212,255,.65), 0 0 ${size*.16}px rgba(0,212,255,.9), inset 0 0 ${size*.14}px rgba(0,212,255,.25)`
              : `0 0 ${size*.18}px rgba(0,212,255,.22), inset 0 0 ${size*.08}px rgba(0,212,255,.1)`,
          animation: speaking ? 'orb-pulse-fast 0.42s ease-in-out infinite'
            : hot ? 'orb-pulse-fast 0.75s ease-in-out infinite'
            : 'orb-pulse 3.8s ease-in-out infinite',
          transition: 'box-shadow 0.5s, background 0.5s',
          overflow: 'hidden',
        }}>
          {/* Specular */}
          <div style={{
            position: 'absolute', top: '11%', left: '18%',
            width: '32%', height: '22%', borderRadius: '50%',
            background: 'rgba(255,255,255,0.18)', filter: 'blur(2px)',
          }} />
          {/* Scan line when energized */}
          {hot && (
            <div style={{
              position: 'absolute', left: 0, right: 0, height: 2,
              background: speaking
                ? 'linear-gradient(90deg,transparent,rgba(16,222,150,.8),transparent)'
                : 'linear-gradient(90deg,transparent,rgba(0,212,255,.7),transparent)',
              animation: `orb-scan ${speaking ? '0.9s' : '1.4s'} ease-in-out infinite`,
            }} />
          )}
        </div>
      </div>
    </>
  );
}
