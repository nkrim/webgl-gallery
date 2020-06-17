export const spotlight_pass_v = `
#version 100

attribute vec3 a_vert;

varying vec2 v_texcoord;

void main() {
	v_texcoord = (a_vert.xy) * 0.5 + vec2(0.5);
	gl_Position = vec4(a_vert, 1.0);
}

`;

export const spotlight_pass_f = `
precision highp float;

// varyings
varying vec2 v_texcoord;

// texture uniforms
uniform sampler2D u_pos_tex;
uniform sampler2D u_norm_tex;
uniform sampler2D u_albedo_tex;
uniform sampler2D u_rough_metal_tex;

// light uniforms
uniform vec3 u_light_pos;
uniform vec3 u_light_dir;
uniform float u_light_i_angle;
uniform float u_light_o_angle;
uniform float u_light_falloff;

// constants
const float PI = 3.14159265359;


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


void main() {
	// grab texture values
	vec3 P = texture2D(u_pos_tex, v_texcoord).xyz;
	vec3 N = texture2D(u_norm_tex, v_texcoord).xyz;
	vec3 A = texture2D(u_albedo_tex, v_texcoord).xyz;
	vec2 RM = texture2D(u_rough_metal_tex, v_texcoord).xy;

	// spotlight intensity value
	vec3 l_to_p = normalize(P - u_light_pos);
    float cos_angle = dot(l_to_p, u_light_dir);
	float I = 
        step(0.0, dot(N, -l_to_p))
        * step(u_light_o_angle-0.0001, cos_angle) 
        * pow(
    		  (cos_angle - u_light_o_angle) 
    		/ (u_light_i_angle - u_light_o_angle)
		    , u_light_falloff);


	/*
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
    */
    
    gl_FragColor = vec4(vec3(I), 1.0);
}

`;