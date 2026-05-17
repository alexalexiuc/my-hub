import mitt from 'mitt';

type Events = { changed: void };

export const transactionEvents = mitt<Events>();
