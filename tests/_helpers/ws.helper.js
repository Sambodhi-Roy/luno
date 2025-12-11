function waitForMessage(messagesArray, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const existing = messagesArray.shift();
    if (existing) return resolve(existing);

    const interval = setInterval(() => {
      if (messagesArray.length > 0) {
        clearInterval(interval);
        resolve(messagesArray.shift());
      }
    }, 50);

    setTimeout(() => {
      clearInterval(interval);
      reject(new Error("timeout waiting for WS message"));
    }, timeout);
  });
}

module.exports = { waitForMessage };
