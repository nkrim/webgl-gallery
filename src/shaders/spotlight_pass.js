// CONSTANTS
export const PCSS_BLOCKER_GRID_SIZE = 4;
export const PCSS_POISSON_SAMPLE_COUNT = 32;

// LOCATIONS
export const spotlight_pass_l = {
    attribs: {
        vertex_pos: 'a_vert',
    },
    uniforms: {
        pos_tex: 'u_pos_tex',
        norm_tex: 'u_norm_tex',
        albedo_tex: 'u_albedo_tex',
        rough_metal_tex: 'u_rough_metal_tex',
        shadow_atlas_tex: 'u_shadow_atlas_tex',

        shadowmap_dims: 'u_shadowmap_dims',
        blocker_samples: 'u_blocker_samples',
        poisson_samples: 'u_poisson_samples',

        camera_view_to_light_screen: 'u_camera_view_to_light_screen',

        light_pos: 'u_light_pos',
        light_dir: 'u_light_dir',
        light_color: 'u_light_color',
        light_int:     'u_light_int',
        light_i_angle: 'u_light_i_angle',
        light_o_angle: 'u_light_o_angle',
        light_falloff: 'u_light_falloff',
    }
}

// VERTEX SHADER
export const spotlight_pass_v = `#version 300 es

layout(location = 0) in vec3 a_vert;

out vec2 v_texcoord;

void main() {
	v_texcoord = (a_vert.xy) * 0.5 + vec2(0.5);
	gl_Position = vec4(a_vert, 1.0);
}
`;

// FRAGMENT SHADER
export function gen_spotlight_pass_f() { 
    // generate pcf loop
    let pcf_loop = '';
    for(let i=0; i<PCSS_POISSON_SAMPLE_COUNT; i++) {
        pcf_loop += `
    shadow += texture(u_shadow_atlas_tex, vec3(s_texcoord.xy + u_poisson_samples[${i}]*sample_width*sm_texel, s_texcoord.z), shadow_bias);`;
    }


    return `#version 300 es
precision mediump float;
precision mediump sampler2DShadow;

// varyings
in vec2 v_texcoord;

// texture uniforms
uniform sampler2D u_pos_tex;
uniform sampler2D u_norm_tex;
uniform sampler2D u_albedo_tex;
uniform sampler2D u_rough_metal_tex;
uniform sampler2DShadow u_shadow_atlas_tex;

// shadowmap constants
const int blocker_sample_count = ${PCSS_BLOCKER_GRID_SIZE}*${PCSS_BLOCKER_GRID_SIZE};
const int poisson_sample_count = ${PCSS_POISSON_SAMPLE_COUNT};
// shadowmap uniform
uniform vec2 u_shadowmap_dims;
uniform vec2 u_blocker_samples[blocker_sample_count];
uniform vec2 u_poisson_samples[poisson_sample_count];

// matrix uniforms
uniform mat4 u_camera_view_to_light_screen;

// light uniforms
uniform vec3 u_light_pos;
uniform vec3 u_light_dir;
uniform vec3 u_light_color;
uniform float u_light_int;
uniform float u_light_i_angle;
uniform float u_light_o_angle;
uniform float u_light_falloff;

// out
out vec4 o_fragcolor;

// constants
const float PI = 3.14159265359;
const float shadow_bias = 0.00001;

// pcss constants
const float light_size = 10.0;

// FUNCTION DEFINITIONS
// SHADOW FUNCTIONS
float shadowmap_pcf(vec3 s_texcoord, vec2 sm_resolution, float sample_width);
float pcss_blocker_distance(vec3 s_texcoord, float region_scale);
float shadowmap_pcss(vec3 s_texcoord, float light_size);
// PBR FUNCTIONS
float DistributionGGX(vec3 N, vec3 H, float roughness);
float GeometrySchlickGGX(float NdotV, float roughness);
float GeometrySmith(vec3 N, vec3 V, vec3 L, float roughness);

void main() {
	// grab texture values
	vec3 P = texture(u_pos_tex, v_texcoord).xyz;
	vec3 N = texture(u_norm_tex, v_texcoord).xyz;
	vec3 A = texture(u_albedo_tex, v_texcoord).xyz;
	vec2 RM = texture(u_rough_metal_tex, v_texcoord).xy;

	// spotlight intensity value
	vec3 l_to_p = normalize(P - u_light_pos);
    float cos_angle = dot(l_to_p, u_light_dir);
    if(dot(N, -l_to_p) < 0.0 || cos_angle < u_light_o_angle-0.0001) {
        discard;
    }
	float I = u_light_int * pow((cos_angle - u_light_o_angle) / (u_light_i_angle - u_light_o_angle), u_light_falloff);

    // shadow map test
    vec4 P_from_light = u_camera_view_to_light_screen * vec4(P, 1.0);
    P_from_light.xyz /= P_from_light.w;
    P_from_light.xyz *= 0.5;
    P_from_light.xyz += 0.5;
    float shadow_sample = shadowmap_pcf(P_from_light.xyz, u_shadowmap_dims, 10.0);

    if(shadow_sample < 0.0001)
        discard;

    o_fragcolor = vec4(I*A*u_light_color*shadow_sample, 1.0);
    //o_fragcolor = vec4(vec3(P_from_light.z-depth_sample), 1.0);
    //o_fragcolor = vec4(P_from_light.xy, 0.0, 1.0);
    return;
}

// SHADOW FUNCTIONS
float shadowmap_pcf(vec3 s_texcoord, vec2 sm_resolution, float sample_width) {
    float shadow = 0.0;
    vec2 sm_texel = 1.0/sm_resolution;
    ${pcf_loop}
    return shadow/float(poisson_sample_count);
}
float pcss_blocker_distance(vec3 s_texcoord, float region_scale) {
    return 0.0;
}
float shadowmap_pcss(vec3 s_texcoord, float light_size) {
    return 0.0;    
}







/*float I = 
        step(0.0, dot(N, -l_to_p))
        * step(u_light_o_angle-0.0001, cos_angle) 
        * pow(
              (cos_angle - u_light_o_angle) 
            / (u_light_i_angle - u_light_o_angle)
            , u_light_falloff);*/



    /*
// PBR stuff for later
/*void main_extra() {
    
    vec3 F0 = vec3(0.04); 
    F0 = mix(F0, A, RM[1]);
	           
    // reflectance equation
    vec3 light_out = vec3(0.0);

    // calculate per-light radiance
    vec3 L = normalize(lightPositions[i] - WorldPos);
    vec3 H = normalize(V + L);
    float distance    = length(lightPositions[i] - WorldPos);
    float attenuation = 1.0 / (distance * distance);
    vec3 radiance     = lightColors[i] * attenuation;        
    
    // cook-torrance brdf
    float NDF = DistributionGGX(N, H, roughness);        
    float G   = GeometrySmith(N, V, L, roughness);      
    vec3 F    = fresnelSchlick(max(dot(H, V), 0.0), F0);       
    
    vec3 kS = F;
    vec3 kD = vec3(1.0) - kS;
    kD *= 1.0 - metallic;	  
    
    vec3 numerator    = NDF * G * F;
    float denominator = 4.0 * max(dot(N, V), 0.0) * max(dot(N, L), 0.0);
    vec3 specular     = numerator / max(denominator, 0.001);  
        
    // add to outgoing radiance Lo
    float NdotL = max(dot(N, L), 0.0);                
    Lo += (kD * albedo / PI + specular) * radiance * NdotL;
    
    o_fragcolor = vec4(I*u_light_color*A, 1.0);
}*/

// pbr functions
// source: https://learnopengl.com/PBR/Lighting
float DistributionGGX(vec3 N, vec3 H, float roughness)
{
    float a      = roughness*roughness;
    float a2     = a*a;
    float NdotH  = max(dot(N, H), 0.0);
    float NdotH2 = NdotH*NdotH;
    
    float num   = a2;
    float denom = (NdotH2 * (a2 - 1.0) + 1.0);
    denom = PI * denom * denom;
    
    return num / denom;
}
float GeometrySchlickGGX(float NdotV, float roughness)
{
    float r = (roughness + 1.0);
    float k = (r*r) / 8.0;

    float num   = NdotV;
    float denom = NdotV * (1.0 - k) + k;
    
    return num / denom;
}
float GeometrySmith(vec3 N, vec3 V, vec3 L, float roughness)
{
    float NdotV = max(dot(N, V), 0.0);
    float NdotL = max(dot(N, L), 0.0);
    float ggx2  = GeometrySchlickGGX(NdotV, roughness);
    float ggx1  = GeometrySchlickGGX(NdotL, roughness);
    
    return ggx1 * ggx2;
}

`};