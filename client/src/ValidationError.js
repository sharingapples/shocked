function ValidationError(message) {
  this.message = message;
}

ValidationError.proptotype = new Error();

export default ValidationError;
