// Shared wind-sway vertex/fragment shader pair — the actual GLSL source,
// not just the same idea reimplemented twice. Originally built in
// vegetation.tsx (Phase D) for grass/paddy blades; trees.tsx reuses this
// exact pair for tree canopies rather than writing a second sway
// mechanism, per the brief's explicit ask. Both consumers still choose
// their own per-instance geometry/placement/colours and their own
// uAmp/uFreq uniform VALUES — only the shader logic itself is shared.
//
// Technique: per-vertex sway off one uTime uniform. `position.y + 0.5`
// (geometry is always a centred unit primitive) gives 0 at the base and 1
// at the tip, so displacement grows toward the tip while the base stays
// planted — the standard "grass shader" trick, here reused unmodified for
// canopy sway (the base of a tree's canopy, near the trunk, barely moves;
// the outer/upper canopy sways more). `instanceMatrix[3].xyz` gives each
// instance's own position for a phase offset, so a whole field/canopy
// reads as a travelling wave rather than every instance bobbing in
// lockstep. The CPU sets instance transforms once at layout and never
// touches them again — the only per-frame cost is one uniform update.

export const SWAY_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uAmp;
  uniform float uFreq;
  varying float vT;
  void main() {
    vT = position.y + 0.5;
    vec3 pos = position;
    vec3 instOrigin = instanceMatrix[3].xyz;
    float phase = instOrigin.x * 0.15 + instOrigin.z * 0.15;
    pos.x += sin(uTime * uFreq + phase) * uAmp * vT;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(pos, 1.0);
  }
`;

export const SWAY_FRAG = /* glsl */ `
  precision mediump float;
  uniform vec3 uColorBase;
  uniform vec3 uColorTip;
  varying float vT;
  void main() {
    gl_FragColor = vec4(mix(uColorBase, uColorTip, vT), 1.0);
  }
`;
