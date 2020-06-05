export const room_config = [
	{
		/* TEST ROOM 01 (octagon with 4 pillars) */
		room_scale: 3,
		wall_height: 6,
		wall_paths: [
			// OUTER WALLS
			[ 2,4,  4,0,  2,-4,  -2,-4,  -4,0,  -2,4 ],
			// LEFT PILLAR
			[ 1.5,0.25,  1,0.25,  1,-0.25,  1.5,-0.25,  1.5,0.25, ],
			// RIGHT PILLAR
			[ -1,0.25,  -1.5,0.25,  -1.5,-0.25,  -1,-0.25,  -1,0.25, ],
		]
	}
]