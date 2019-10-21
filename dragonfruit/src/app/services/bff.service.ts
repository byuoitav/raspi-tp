import { Injectable, EventEmitter } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import {
  $WebSocket,
  WebSocketConfig
} from 'angular2-websocket/angular2-websocket';
import { JsonConvert } from 'json2typescript';
import { Device, UIConfig, IOConfiguration, DBRoom, Preset } from '../objects/database';
import { Room, ControlGroup, Display, Input, AudioDevice, AudioGroup, PresentGroup } from '../objects/control';

@Injectable({
  providedIn: 'root'
})
export class BFFService {
  room: Room;
  done: EventEmitter<boolean>;
  ws: WebSocket;

  constructor() {
    this.done = new EventEmitter();
    // this.room = new Room();
  }

  connectToRoom(controlKey: string) {
    const endpoint = 'ws://' + window.location.hostname + ':88/ws/' + controlKey;
    this.ws = new WebSocket(endpoint);

    this.ws.onmessage = event => {
      console.log('ws event', event);
      this.room = JSON.parse(event.data);
      // this.room = Object.assign(new Room(), JSON.parse(event.data));

      console.log('Websocket data:', this.room);

      this.done.emit(true);
    };

    this.ws.onerror = event => {
      console.error('Websocket error', event);
    };
  }

  setInput(display: Display, input: Input) {
    const kv = {
      'setInput': {
        display: display,
        input: input
      }
    };

    console.log(JSON.stringify(kv));
    this.ws.send(JSON.stringify(kv));
  }

  setVolume(ad: AudioDevice, level: number) {
    const kv = {
      'setVolume': {
        audioDevice: ad,
        level: level
      }
    };

    console.log(JSON.stringify(kv));
    this.ws.send(JSON.stringify(kv));
  }

  setMuted(ad: AudioDevice, m: boolean) {
    const kv = {
      'setMuted': {
        audioDevice: ad,
        muted: m
      }
    };

    console.log(JSON.stringify(kv));
    this.ws.send(JSON.stringify(kv));
  }
}
