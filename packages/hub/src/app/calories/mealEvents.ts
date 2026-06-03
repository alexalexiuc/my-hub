import mitt from 'mitt';

type Events = { changed: void };

export const mealEvents = mitt<Events>();
