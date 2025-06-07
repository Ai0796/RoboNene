// client/methods/getEventData.ts
import * as fs from 'fs';

export interface EventData {
  id: number;
  banner: string;
  name: string;
  startAt: number;
  aggregateAt: number;
  closedAt: number;
  eventType: string;
  assetbundleName: string;
  description: string;
}

function getEventData(eventID: number): EventData {
  const data: EventData[] = JSON.parse(fs.readFileSync('./sekai_master/events.json', 'utf8')) as EventData[];

  for (let i = data.length - 1; i >= 0; i--) {
    if (data[i].id === eventID) {
      return data[i];
    }
  }

  return {
    id: -1,
    name: 'Unknown Event',
    description: 'Unknown Event',
    banner: '',
    startAt: 0,
    aggregateAt: 0,
    closedAt: 0,
    eventType: '',
    assetbundleName: ''
  };
}

export default getEventData;