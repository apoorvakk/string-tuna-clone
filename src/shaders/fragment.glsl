// This code is injected AFTER dithering, near the end of the fragment main() function.
// DO NOT DEFINE FUNCTIONS HERE as we are inside main().
vec3 baseColor = gl_FragColor.rgb;

// 1. Heavy Granulated Noise: Seeded with uTime for an animated, shimmering grain
// Scale is matched for a tight grain like the reference
float n = fract(sin(dot(gl_FragCoord.xy * .5, vec2(12.9898 + uTime, 78.233 + uTime))) * 43758.5453);

// Heavy noisy overlay: 70% color, 30% noise influence for a pronounced grainy texture
vec3 noiseLayer = baseColor * (0.7 + 0.25 * n); 

// 2. High Contrast and Dimmed Brightness: Boosting power curve for deeper blacks and punchier highlights
noiseLayer = pow(max(noiseLayer * 1.5, 0.0), vec3(2.5));

// 3. Fresnel highlighting to maintain metallic definition through the noise
vec3 myNormal = normalize(vNormal);
vec3 myViewDir = normalize(vViewPosition);

float fresnel = dot(myViewDir, myNormal);
fresnel = clamp(1.0 - fresnel, 0.0, 1.0);

// Crisp, bright-steel edge highlight
vec3 highlightTint = vec3(0.7, 0.8, 1.0); 
noiseLayer += highlightTint * pow(fresnel, 5.0) * 0.9;

// Final color output with heavy granulated texture
vec3 finalColor = noiseLayer * uBlackout;
// Add a darker gray base with bright shimmering noise that is visible even when blacked out
finalColor += (vec3(-0.07) + vec3(0.22) * n) * (1.0 - uBlackout);

gl_FragColor = vec4(finalColor, gl_FragColor.a);


