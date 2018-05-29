# shocked
A websocket server for executing your apis, dispatching redux actions on clients
and emitting events from server.

# Installation
> `$ yarn add shocked`
> `$ npm install --save shocked`

# Usage
* Starting the server
```javascript
import { start } from 'shocked';

const url = 'shocked/:app/:token';
start({ port, url }, (session) => {
  
});
```
* Declaring and binding your api
```javascript
import { createScope } from 'shocked';

const demo = createScope('demo');

async function clap(numberOfHands) {
  if (!numberOfHands) {
    throw new Error('Cannot clap without any hands');
  }

  if (numberOfHands > 2) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (numberOfHands > 10) {
          reject(new Error('What kind of a monster are you?'));
        } else {
          resolve('Its difficult to clap with so many hands');
        }
      }, 500);
    });
  }

  return `Clap Clap Clap with ${numberOfHands}`;
}

// Expose clap via demo scope
demo(clap);
```