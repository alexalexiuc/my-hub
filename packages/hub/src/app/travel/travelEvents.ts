import mitt from 'mitt';

type Events = { changed: void };

export const travelEvents = mitt<Events>();
