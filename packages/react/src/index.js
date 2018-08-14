import { connect } from 'react-redux';
import Shocked from './Shocked';
import track from './Tracker';

const connectTracker = tracker => (mapStateToProps, mapApiToProps, mergeProps, options) => (
  connect(mapStateToProps, mapApiToProps, mergeProps, {
    ...options,
    storeKey: tracker,
  })
);

export {
  track,
  Shocked,
  connectTracker as connect,
};
