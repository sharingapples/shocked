/* global XMLHttpRequest */
import ValidationError from './ValidationError';

function fixUrl(url) {
  if (url.startsWith('ws:')) {
    return `http:${url.substr(3)}`;
  } else if (url.startsWith('wss:')) {
    return `https:${url.substr(4)}`;
  }
  return url;
}

const XHRValidator = wsUrl => new Promise((resolve, reject) => {
  const xhr = new XMLHttpRequest();
  const url = fixUrl(wsUrl);

  xhr.open('GET', url);
  xhr.setRequestHeader('Accept', 'application/json');
  xhr.onreadystatechange = () => {
    if (xhr.readyState === XMLHttpRequest.DONE) {
      if (xhr.status === 200) {
        resolve(JSON.parse(xhr.responseText));
      } else if (xhr.status === 401) {
        reject(new ValidationError('Unauthorized access/Invalid session'));
      } else {
        reject(new Error(`Could not validate ${url}. Got ${xhr.status}-${xhr.statusText}`));
      }
    }
  };
  // send the request
  xhr.send();
});

export default XHRValidator;
