import React, { useState, ChangeEvent, Dispatch } from 'react';
import { useShockedApi } from 'shocked';

function handleChange(setter: Dispatch<number>) {
  return (e: ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value) || 0;
    setter(v);
  }
}

export default function Summation() {
  const [a, setA] = useState(0);
  const [b, setB] = useState(0);

  const sum = useShockedApi((api) => {
    return api.add([a, b]);
  }, [a, b]);

  console.log('Sum is', sum);
  return (
    <div>
      <input type="text" value={a} onChange={handleChange(setA)} />
      +
      <input type="text" value={b} onChange={handleChange(setB)} />
      =
      <input type="text" readOnly value={sum} />
    </div>
  );
}