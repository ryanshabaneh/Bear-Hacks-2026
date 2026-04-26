// 24×36 pixel chibi character with headphones, hand-laid SVG rects.
// Sits next to the stereo. Bob animation comes from CSS on the wrapper.

export function PixelCharacter({ className }: { className?: string }) {
  // Palette — picks from the cozy room palette
  const C = {
    band: "#1a1a22",
    cup: "#ef7d57",
    cupShade: "#b8553a",
    hair: "#3d2613",
    hairLight: "#5c3a21",
    skin: "#f4c89a",
    skinShade: "#d4a07a",
    eye: "#1a1a22",
    cheek: "#ff8eb6",
    mouth: "#b13e53",
    shirt: "#5eead4",
    shirtShade: "#3aa39a",
    pants: "#3b5dc9",
    pantsShade: "#29366f",
    shoes: "#1a1a22",
    note: "#ff8eb6",
  };

  return (
    <svg
      className={className}
      viewBox="0 0 28 40"
      width="64"
      height="92"
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      {/* ===== Headphone band: arch over the head ===== */}
      <rect x="9" y="3" width="10" height="1" fill={C.band} />
      <rect x="8" y="4" width="12" height="1" fill={C.band} />
      <rect x="7" y="5" width="2" height="2" fill={C.band} />
      <rect x="19" y="5" width="2" height="2" fill={C.band} />

      {/* ===== Hair (under the band) ===== */}
      <rect x="9" y="4" width="10" height="1" fill={C.hair} />
      <rect x="8" y="5" width="12" height="3" fill={C.hair} />
      <rect x="9" y="8" width="10" height="1" fill={C.hair} />
      <rect x="9" y="5" width="2" height="1" fill={C.hairLight} />
      <rect x="13" y="5" width="2" height="1" fill={C.hairLight} />

      {/* ===== Face (skin) ===== */}
      <rect x="9" y="8" width="10" height="6" fill={C.skin} />
      <rect x="10" y="14" width="8" height="2" fill={C.skin} />
      <rect x="11" y="16" width="6" height="2" fill={C.skin} />

      {/* Skin shade under chin */}
      <rect x="11" y="17" width="6" height="1" fill={C.skinShade} />

      {/* ===== Ear cups ===== */}
      <rect x="5" y="7" width="3" height="5" fill={C.cup} />
      <rect x="20" y="7" width="3" height="5" fill={C.cup} />
      <rect x="5" y="11" width="3" height="1" fill={C.cupShade} />
      <rect x="20" y="11" width="3" height="1" fill={C.cupShade} />
      <rect x="5" y="7" width="1" height="1" fill={C.cupShade} />
      <rect x="22" y="7" width="1" height="1" fill={C.cupShade} />

      {/* ===== Eyes ===== */}
      <rect x="11" y="10" width="1" height="2" fill={C.eye} />
      <rect x="16" y="10" width="1" height="2" fill={C.eye} />
      {/* Eye highlight (single white pixel) */}
      <rect x="11" y="10" width="1" height="1" fill="#f4f4f4" />
      <rect x="16" y="10" width="1" height="1" fill="#f4f4f4" />

      {/* Cheeks */}
      <rect x="9" y="12" width="1" height="1" fill={C.cheek} />
      <rect x="18" y="12" width="1" height="1" fill={C.cheek} />

      {/* Mouth */}
      <rect x="13" y="13" width="2" height="1" fill={C.mouth} />

      {/* ===== Shirt body ===== */}
      <rect x="6" y="18" width="16" height="9" fill={C.shirt} />
      <rect x="7" y="17" width="14" height="1" fill={C.shirt} />
      {/* Sleeves */}
      <rect x="4" y="19" width="2" height="6" fill={C.shirt} />
      <rect x="22" y="19" width="2" height="6" fill={C.shirt} />
      {/* Shirt shading at bottom */}
      <rect x="6" y="26" width="16" height="1" fill={C.shirtShade} />
      {/* Tiny star/heart on the shirt */}
      <rect x="13" y="21" width="2" height="1" fill="#f4f4f4" />
      <rect x="14" y="22" width="1" height="1" fill="#f4f4f4" />
      <rect x="13" y="22" width="1" height="1" fill="#f4f4f4" />

      {/* Hands */}
      <rect x="4" y="25" width="2" height="2" fill={C.skin} />
      <rect x="22" y="25" width="2" height="2" fill={C.skin} />

      {/* ===== Pants ===== */}
      <rect x="6" y="27" width="16" height="8" fill={C.pants} />
      <rect x="13" y="28" width="2" height="7" fill={C.pantsShade} />
      <rect x="6" y="34" width="16" height="1" fill={C.pantsShade} />

      {/* ===== Shoes ===== */}
      <rect x="5" y="35" width="7" height="3" fill={C.shoes} />
      <rect x="16" y="35" width="7" height="3" fill={C.shoes} />
      <rect x="5" y="37" width="7" height="1" fill="#0a0a10" />
      <rect x="16" y="37" width="7" height="1" fill="#0a0a10" />

      {/* ===== Floating notes near the ear ===== */}
      <rect x="2" y="6" width="1" height="1" fill={C.note} />
      <rect x="1" y="7" width="1" height="1" fill={C.note} />
      <rect x="2" y="8" width="1" height="1" fill={C.note} />
      <rect x="1" y="3" width="1" height="1" fill="#41a6f6" />
    </svg>
  );
}
