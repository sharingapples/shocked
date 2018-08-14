const { Service } = require('shocked');
const UserTracker = require('./UserTracker');

class TodoService extends Service {
  constructor(server) {
    super(server, { url: '/todo/:userId' });

    // The database
    this.users = ['1', '2', '3'];

    // Register the trackers available with this service
    this.registerTracker(UserTracker);
  }

  async onValidate({ params }) {
    const user = this.users.find(u => u === params.userId);
    if (!user) {
      throw new Error(`Unknown User ${params.userId}`);
    }
    return { user };
  }
}

module.exports = TodoService;
