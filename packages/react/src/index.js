import { connect } from 'react-redux';
import { TYPE_TRACKER_INIT } from 'shocked-client';
import Shocked from './Shocked';
import track from './Tracker';


const connectTracker = tracker => (mapStateToProps, mapApiToProps, mergeProps, options) => (
  connect(mapStateToProps, mapApiToProps, mergeProps, {
    ...options,
    storeKey: tracker,
  })
);

export {
  TYPE_TRACKER_INIT,
  track,
  Shocked,
  connectTracker as connect,
};
