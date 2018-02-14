/* global XMLHttpRequest */

const XHRValidator = url => new Promise((resolve, reject) => {
  const xhr = new XMLHttpRequest();
  xhr.open('GET', url);
  xhr.setRequestHeader('Accept', 'application/json');
  xhr.onreadystatechange = () => {
    if (xhr.readyState === XMLHttpRequest.DONE) {
      if (xhr.status === 200) {
        resolve(JSON.parse(xhr.responseText));
      } else if (xhr.status === 401) {
        reject(new Error('Unauthorized access/Invalid session'));
      } else {
        reject(new Error(`Could not validate ${url}. Got ${xhr.status}-${xhr.statusText}`));
      }
    }
  };
  // send the request
  xhr.send();
});

module.exports = XHRValidator;
