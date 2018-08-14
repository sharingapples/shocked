const totalKeys = 100;

const map = {};
for (let i = 0; i < totalKeys; i += 1) {
  const key = `Key-${i + 100000}`;
  map[key] = {
    key,
    str: `Some string - ${i}`,
    i,
    currentTime: new Date(),
  };
}

const iterations = 1000000;

let fails = 0;
let success = 0;
function fn(i) {
  // const n = Math.floor(Math.random() * totalKeys * 2);
  // const key = `Key-${n}`;
  const v = map[i];
  // if (v) {
  //   success += 1;
  // } else {
  //   fails += 1;
  // }
};

console.log(process.memoryUsage());
const t = Date.now();
for (let i = 0; i < iterations; i += 1) {
  fn(i);
};

console.log(process.memoryUsage());
const duration = Date.now() - t;
console.log('Total time taken:', duration, 'ms');
console.log('Per operation', (duration * 1000) / iterations, 'µs');
console.log('Fails', fails, ' Success', success, fails + success);
