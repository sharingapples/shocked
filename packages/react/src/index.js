import { connect } from 'react-redux';
import { TYPE_TRACKER_INIT, TYPE_BATCH_ACTIONS } from 'shocked-client';
import Shocked from './Shocked';
import Tracker from './Tracker';


const connectTracker = tracker => (mapStateToProps, mapApiToProps, mergeProps, options) => (
  connect(mapStateToProps, mapApiToProps, mergeProps, {
    ...options,
    storeKey: tracker,
  })
);

export {
  TYPE_TRACKER_INIT,
  TYPE_BATCH_ACTIONS,

  Tracker,
  Shocked,

  connectTracker as connect,
};
