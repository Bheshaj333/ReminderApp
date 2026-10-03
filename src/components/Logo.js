import React from 'react';
import Svg, { Defs, LinearGradient, RadialGradient, Stop, Path, Circle, Line, Rect, G } from 'react-native-svg';

// "Echo Dial": an open clock dial whose gap emits sound waves - time that speaks.
// Same geometry as the generated launcher icon (1000-unit design box).
const CX = 395;
const CY = 500;

function polar(r, deg) {
  const a = (deg * Math.PI) / 180;
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
}

function arc(r, from, to) {
  const [x1, y1] = polar(r, from);
  const [x2, y2] = polar(r, to);
  const large = (to - from + 360) % 360 > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
}

const TICKS = [270, 90, 180].map(deg => [polar(208, deg), polar(246, deg)]);
const HAND_END = polar(190, -18);
const ORBIT = polar(370, 222);
const WAVES = [
  { r: 365, span: 27, w: 40, o: 1 },
  { r: 442, span: 32, w: 36, o: 0.75 },
  { r: 519, span: 36, w: 32, o: 0.5 },
];

/** `tile` draws the dark rounded app-icon background behind the mark. */
export default function Logo({ size = 40, tile = false }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 1000 1000">
      <Defs>
        <LinearGradient id="stroke" x1="0.2" y1="0" x2="0.8" y2="1">
          <Stop offset="0" stopColor="#B68CFF" />
          <Stop offset="0.45" stopColor="#60E8C8" />
          <Stop offset="1" stopColor="#48D6FF" />
        </LinearGradient>
        <RadialGradient id="bg" cx="0.5" cy="0.42" r="0.75">
          <Stop offset="0" stopColor="#14463F" />
          <Stop offset="1" stopColor="#040E10" />
        </RadialGradient>
      </Defs>
      {tile && <Rect x="0" y="0" width="1000" height="1000" rx="230" fill="url(#bg)" />}
      <G transform={tile ? 'translate(500 500) scale(0.78) translate(-500 -500)' : undefined}>
        <Path d={arc(277, 37, 323)} stroke="url(#stroke)" strokeWidth={46} strokeLinecap="round" fill="none" />
        {TICKS.map(([[x1, y1], [x2, y2]], i) => (
          <Line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="url(#stroke)" strokeWidth={22} strokeLinecap="round" />
        ))}
        <Line x1={CX} y1={CY} x2={HAND_END[0]} y2={HAND_END[1]} stroke="url(#stroke)" strokeWidth={34} strokeLinecap="round" />
        <Circle cx={CX} cy={CY} r={44} fill="url(#stroke)" />
        <Circle cx={ORBIT[0]} cy={ORBIT[1]} r={26} fill="url(#stroke)" />
        {WAVES.map((w, i) => (
          <Path key={i} d={arc(w.r, -w.span, w.span)} stroke="url(#stroke)" strokeOpacity={w.o}
            strokeWidth={w.w} strokeLinecap="round" fill="none" />
        ))}
      </G>
    </Svg>
  );
}
