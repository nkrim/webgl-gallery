import { Room } from '../ts/room.ts';
import { Camera } from '../ts/camera.ts';
import { Spotlight } from '../ts/spotlight.ts';

export function load_room(r) {
	return new Room(
		r.wall_paths, r.wall_height, r.wall_bias, r.floor_indices, r.room_scale,
		r.wall_albedo, r.wall_rough_metal, r.floor_albedo, r.floor_rough_metal, r.ceil_albedo, r.ceil_rough_metal,
		r.ambient_color, r.ambient_intensity, r.spotlights);
}

export const room_config = [
	{
		/* TEST ROOM 01 (octagon with 4 pillars) */
		room_scale: 3,
		wall_height: 6,
		wall_bias: 1,
		wall_albedo: [0.8,0.8,0.8], wall_rough_metal: [1.0, 0.0],
		floor_albedo: [0.8,0.8,0.3], floor_rough_metal: [0.0, 1.0],
		ceil_albedo: [0.3,0.3,0.8], ceil_rough_metal: [1.0, 1.0],
		wall_paths: [
			// OUTER WALLS
			[ 1,4, 2,4,  4,0,  2,-4,  -2,-4,  -4,0,  -2,4, -1,4 ],
			// RIGHT PILLAR
			//[ 1.5,0.25,  1,0.25,  1,-0.25,  1.5,-0.25,  1.5,0.25, ],
			[1.3,0.05, 1.2,0.05, 1.2,-0.05, 1.3,-0.05, 1.3,0.05],
			// LEFT PILLAR
			[ -1,0.25,  -1.5,0.25,  -1.5,-0.25,  -1,-0.25,  -1,0.25, ],
		],
		floor_indices: [
			0,0, 0,1, 1,1,   1,0, 1,1, 0,1,   1,0, 0,1, 0,2,   1,0, 0,2, 1,3,   0,2, 0,3, 1,3,   0,3, 1,2, 1,3,
			0,3, 0,4, 1,2,   0,4, 2,3, 1,2,   0,4, 2,2, 2,3,   0,4, 0,5, 2,2,   0,5, 2,1, 2,2,   0,5, 0,6, 2,1,
			0,6, 0,7, 2,1,   0,7, 2,0, 2,1,   0,7, 0,0, 2,0,   0,0, 1,1, 2,0,   1,1, 1,2, 2,0,   1,2, 2,3, 2,0
		],
		ambient_color: [1.0,1.0,1.0], ambient_intensity: 0.1,
		spotlights: [
			new Spotlight(new Camera([3.1, 4, 1.75], -0.23441, Math.PI/4), [1.0,0.95,0.9], 1.5, [25,45], 1, [1.0,100.0]),
			// new Spotlight(new Camera([3, 0.25, -0.05], Math.PI/8, Math.PI/2), [1.0,0.95,0.9], 1.5, [35,65], 1, [0.1,100.0]),
		]
	}
]