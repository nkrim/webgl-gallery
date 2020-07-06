import { pretty_float } from '../ts/utils.ts';

// CONSTANTS
export const PCF_POISSON_SAMPLE_COUNT = 64;
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
        shadow_atlas_linear_tex: 'u_shadow_atlas_linear_tex',
        shadow_atlas_tex: 'u_shadow_atlas_tex',

        shadow_atlas_info: 'u_shadow_atlas_info',
        shadowmap_dims: 'u_shadowmap_dims',
        shadow_t: 'u_shadow_t',

        // camera_view_to_world: 'u_camera_view_to_world',
        camera_view_to_light_view: 'u_camera_view_to_light_view',
        light_proj: 'u_light_proj',

        light_pos: 'u_light_pos',
        light_dir: 'u_light_dir',
        light_color: 'u_light_color',
        light_int:     'u_light_int',
        light_i_angle: 'u_light_i_angle',
        light_o_angle: 'u_light_o_angle',
        light_falloff: 'u_light_falloff',
        light_znear: 'u_light_znear',
        light_zfar: 'u_light_zfar',
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
export function gen_spotlight_pass_f(pcf_samples, pcss_samples) { 
    const decimal_length = 8;
    const pretty_vec2 = function(a,b) { return `vec2(${pretty_float(a, decimal_length)},${pretty_float(b, decimal_length)})`; }
    // genereate pcf_samples string
    let pcf_samples_string = pretty_vec2(pcf_samples[0], pcf_samples[1]);
    for(let i=2; i<2*PCF_POISSON_SAMPLE_COUNT; i+=2)
        pcf_samples_string += `,${pretty_vec2(pcf_samples[i], pcf_samples[i+1])}`;
    // genereate pccc_samples string
    let pcss_samples_string = pretty_vec2(pcss_samples[0], pcss_samples[1]);
    for(let i=2; i<2*PCSS_POISSON_SAMPLE_COUNT; i+=2)
        pcss_samples_string += `,${pretty_vec2(pcss_samples[i], pcss_samples[i+1])}`;

    // generate pcf loop
    let pcf_loop = '';
    for(let i=0; i<PCF_POISSON_SAMPLE_COUNT; i++) {
        pcf_loop += `
    shadow += texture(u_shadow_atlas_tex, vec3(s_projcoord.xy + rot*(pcf_samples[${i}]*sample_width*sm_texel), s_projcoord.z+shadow_bias));`;
    }

    // generate pcss loop
    let pcss_loop = '';
    for(let i=0; i<PCSS_POISSON_SAMPLE_COUNT; i++) {
        pcss_loop += `
        offset = rot*(pcss_samples[${i}] * region_scale * sm_texel);
        blocker_sample = texture(u_shadow_atlas_linear_tex, s_texcoord + offset).x;
        if(blocker_sample < linear_z) blockers++;
        if(blocker_sample < linear_z) avg_blocker_depth += blocker_sample;`
    }

    return `#version 300 es
precision highp float;
precision highp sampler2DShadow;

// varyings
in vec2 v_texcoord;

// texture uniforms
uniform sampler2D u_pos_tex;
uniform sampler2D u_norm_tex;
uniform sampler2D u_albedo_tex;
uniform sampler2D u_rough_metal_tex;
uniform sampler2D u_shadow_atlas_linear_tex;
uniform sampler2DShadow u_shadow_atlas_tex;

// shadowmap constants
const int pcf_sample_count = ${PCF_POISSON_SAMPLE_COUNT};
const int pcss_sample_count = ${PCSS_POISSON_SAMPLE_COUNT};
// shadowmap arrays
const vec2 pcf_samples[pcf_sample_count] = vec2[](${pcf_samples_string});
const vec2 pcss_samples[pcss_sample_count] = vec2[](${pcss_samples_string});

// shadowmap uniforms
uniform vec2 u_shadowmap_dims;
uniform vec3 u_shadow_atlas_info;
uniform float u_shadow_t;

// matrix uniforms
// uniform mat4 u_camera_view_to_world;
uniform mat4 u_camera_view_to_light_view;
uniform mat4 u_light_proj;

// light uniforms
uniform vec3 u_light_pos;
uniform vec3 u_light_dir;
uniform vec3 u_light_color;
uniform float u_light_int;
uniform float u_light_i_angle;
uniform float u_light_o_angle;
uniform float u_light_falloff;
uniform float u_light_znear;
uniform float u_light_zfar;
//uniform float u_light_fov;

// out
out vec4 o_fragcolor;

// constants
const float PI = 3.14159265359;
const float max_bias = 0.005;
const float min_bias = 0.0001;

// pcss constantas
const float light_size = 4.0;

// FUNCTION DEFINITIONS
// ====================

// SHADOW FUNCTIONS
// ----------------
float linearize_depth(float proj_depth, float znear, float zfar) {
    return (2.0*znear) / (zfar + znear - proj_depth*(zfar - znear));
}
float random (vec2 uv) {
    return fract(sin(dot(uv.xy,vec2(12.9898, 121.233)))*43758.5453123);
}
float shadowmap_pcf(vec3 s_projcoord, vec2 sm_resolution, float sample_width, float shadow_bias);
vec2 pcss_blocker_distance(vec2 s_texcoord, float linear_z, vec2 sm_resolution, float region_scale);
float shadowmap_pcss(vec3 s_projcoord, float light_z, float eye_z, float light_size, float shadow_bias, float rand);

// PBR FUNCTIONS
// -------------
float DistributionGGX(vec3 N, vec3 H, float roughness);
float GeometrySchlickGGX(float NdotV, float roughness);
float GeometrySmith(vec3 N, vec3 V, vec3 L, float roughness);
vec3 fresnelSchlick(float cosTheta, vec3 F0);

// MAIN FUNCTION
// =============
void main() {
    // grab texture values
    // -------------------
	vec3 P = texture(u_pos_tex, v_texcoord).xyz;
	vec3 N = texture(u_norm_tex, v_texcoord).xyz;
	vec3 A = texture(u_albedo_tex, v_texcoord).xyz;
	vec2 RM = texture(u_rough_metal_tex, v_texcoord).xy;

	// spotlight intensity value
    // -------------------------
    vec3 p_to_l_full = u_light_pos - P;
	vec3 p_to_l = normalize(p_to_l_full);
    float cos_angle = dot(p_to_l, -u_light_dir);
    float n_dot_l = dot(N, p_to_l);
    if(n_dot_l < 0.0 || cos_angle < u_light_o_angle-0.0001) {
        discard;
    }
	float I = u_light_int * pow((cos_angle - u_light_o_angle) / (u_light_i_angle - u_light_o_angle), u_light_falloff);
    // I *= n_dot_l;

    // shadowmapping
    // -------------
    // shadow map test
    vec4 P_from_light_view = u_camera_view_to_light_view * vec4(P, 1.0);
    vec4 P_from_light = u_light_proj * P_from_light_view;
    P_from_light.xyz /= P_from_light.w;
    P_from_light.xyz *= 0.5;
    P_from_light.xyz += 0.5;

    // adjust for atlas position
    P_from_light.xy += u_shadow_atlas_info.xy;
    P_from_light.xy /= u_shadow_atlas_info.z;

    // calculate random cos_angle
    vec3 rand_v = P*(vec3(1.0)-N);
    float rand = random(rand_v.xy + rand_v.yz + rand_v.zx);
    rand *= 2.0*PI;
    rand += u_shadow_t;

    // calculate shadows
    float shadow_bias = -max(max_bias * (1.0 - n_dot_l), min_bias);
    float shadow = shadowmap_pcss(P_from_light.xyz, P_from_light_view.z, P.z, light_size, shadow_bias, rand);
    if(shadow < 0.0001)
       discard;
    // o_fragcolor = vec4(I*A*u_light_color*shadow, 1.0);
    // return;

    // pbr rendering
    // -------------
    vec3 F0 = vec3(0.04); 
    F0 = mix(F0, A, RM[1]);

    // calculate per-light radiance
    vec3 p_to_c = normalize(-P);
    vec3 H = normalize(p_to_c + p_to_l);
    // float distance    = length(p_to_l_full);
    // float attenuation = 1.0 / (distance * distance);
    vec3 radiance     = I*u_light_color;//u_light_color * attenuation;        
    
    // cook-torrance brdf
    float NDF = DistributionGGX(N, H, RM[0]);        
    float G   = GeometrySmith(N, p_to_c, p_to_l, RM[0]);      
    vec3 F    = fresnelSchlick(max(dot(H, p_to_c), 0.0), F0);       
    
    vec3 kS = F;
    vec3 kD = vec3(1.0) - kS;
    kD *= 1.0 - RM[1];    
    
    vec3 numerator    = NDF * G * F;
    float denominator = 4.0 * max(dot(N, p_to_c), 0.0) * max(dot(N, p_to_l), 0.0);
    vec3 specular     = numerator / max(denominator, 0.001);  
        
    vec3 light_out = (kD * A / PI + specular) * radiance * max(n_dot_l, 0.0);

    o_fragcolor = vec4(light_out*shadow, 1.0);
    //o_fragcolor = vec4(I*A*u_light_color*shadow, 1.0);
    //o_fragcolor = vec4(vec3(P_from_light.z-depth_sample), 1.0);
    //o_fragcolor = vec4(P_from_light.xy, 0.0, 1.0);
    return;
}

// SHADOW FUNCTIONS
// ================
float shadowmap_pcf(vec3 s_projcoord, vec2 sm_texel, float sample_width, mat2 rot, float shadow_bias) {
    float shadow = 0.0;
    ${pcf_loop}
    return shadow/(float(pcf_sample_count));
}
vec2 pcss_blocker_distance(vec2 s_texcoord, float linear_z, vec2 sm_texel, float region_scale, mat2 rot) {
    int blockers = 0;
    float avg_blocker_depth = 0.0;
    vec2 offset;
    float blocker_sample;
    ${pcss_loop}
    float f_blockers = float(blockers);
    if(blockers > 0) avg_blocker_depth /= f_blockers;
    return vec2(avg_blocker_depth, f_blockers);
}
float shadowmap_pcss(vec3 s_projcoord, float light_z, float eye_z, float light_size, float shadow_bias, float rand) {
    // random rot
    float cos_rot = cos(rand); float sin_rot = sin(rand);
    mat2 rot = mat2(cos_rot, -sin_rot, sin_rot, cos_rot);

    float max_penumbra = 0.1 * min(u_shadowmap_dims.x, u_shadowmap_dims.y);
    float max_search = max_penumbra/5.0;
    float min_search = 4.0;

    vec2 sm_texel = 1.0/u_shadowmap_dims;
    float linear_z = linearize_depth(s_projcoord.z, u_light_znear, u_light_zfar);

    /*
    // failsafe for sharp corners
    // !!!!IMPORTANT - DELETE ONCE I REMOVE SQUARE COLUMNS
    //if(texture(u_shadow_atlas_tex, vec3(s_projcoord.xy, s_projcoord.z+0.00001)) >= 0.9)
    if(texture(u_shadow_atlas_linear_tex, s_projcoord.xy).x > linear_z)
        return 1.0;
    */

    // perform shadowmap filtering
    float search_width = max(min_search,min(max_search, light_size * (light_z - u_light_znear) / min(eye_z, 1.0)));
    search_width /= u_shadow_atlas_info.z; // normalize to atlas
    vec2 blocker_res = pcss_blocker_distance(s_projcoord.xy, linear_z, sm_texel, search_width, rot);
    if(blocker_res.y < 0.9 || blocker_res.x >= linear_z+shadow_bias)
        return 1.0;

    float penumbra_size = light_size * (linear_z - blocker_res.x) / blocker_res.x;
    penumbra_size *= u_light_znear/linear_z;
    penumbra_size = min(penumbra_size, max_penumbra);
    penumbra_size /= u_shadow_atlas_info.z; // normalize to atlas
    float shadow = shadowmap_pcf(s_projcoord, sm_texel, penumbra_size, rot, shadow_bias);
    return shadow;
}

// PBR FUNCTIONS
// =============
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
vec3 fresnelSchlick(float cosTheta, vec3 F0)
{
    return F0 + (1.0 - F0) * pow(1.0 - cosTheta, 5.0);
}  

`};