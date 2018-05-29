import uuid from 'uuid/v4';
import { connect } from 'shocked-client';
import { createStore } from 'redux';

import { PORT } from '../common';

const WebSocket = require('ws');
const readline = require('readline');

global.WebSocket = WebSocket;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const initialState = {
  rooms: {},
  members: [],
};

const reducer = (state = initialState, { type, payload }) => {
  switch (type) {
    case 'ROOMS':
      return {
        ...state,
        rooms: payload,
      };
    case 'MESSAGE':
      console.log(`${payload.from} says ${payload.message}`);
      return state;

    case 'MEMBERS':
      console.log('Members', payload.members);
      return {
        ...state,
        members: payload.members,
      };

    case 'ADD_MEMBER':
      console.log('Add member', payload);
      return {
        ...state,
        members: state.members.concat(payload),
      };
    case 'REMOVE_MEMBER':
      console.log('Remove member', payload);
      return {
        ...state,
        members: state.members.filter(m => m.id !== payload),
      };

    default:
      return state;
  }
};

export const store = createStore(reducer);

const id = uuid();
const name = process.argv[2] || 'No name';

export const client = connect(`ws://localhost:${PORT}/demo/${id}/${name}`, store);

function chatMain(chat) {
  rl.question(' (exit to leave) >', (answer) => {
    if (answer === 'exit') {
      chat.leave();
      // eslint-disable-next-line no-use-before-define
      showRooms(chat);
    } else {
      chat.send(answer);
      chatMain(chat);
    }
  });
}

function showRooms(chat) {
  const state = store.getState();
  console.log('Available Rooms');
  state.rooms.forEach((room, idx) => console.log(idx, room));

  rl.question('Enter room to join', async (answer) => {
    try {
      await chat.join(answer);
      chatMain(chat);
    } catch (err) {
      console.error('Could not join', err);
      showRooms(chat);
    }
  });
}

client.on('connect', async () => {
  console.log('Connected');
  try {
    const chat = await client.scope('chat');
    showRooms(chat);
  } catch (err) {
    console.error('error getting scope', err);
  }
  // console.log(chat);
});

client.on('error', (err) => {
  console.log('Error during connection', err);
});
