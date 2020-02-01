

/**
 * Client class use to augment a model with particles capabilities
 *
 * @module model/AParticlesCapability
 * @author Matteo Cantarelli
 */

export default class AParticlesCapability {

  contructor (experimentsController) {
    if (!this.experimentsController) {
      throw new Error("experimentsController is required.");
    }
    this.capabilityId = 'ParticlesCapability';
    this.watched = false;
    this.timeSeries = null;
    this.experimentsController = experimentsController;
  }
  /**
   * Get value of quantity
   *
   * @command Variable.getTimeSeries()
   * @returns {String} Value of quantity
   */
  getTimeSeries () {
    if (!this.timeSeries) {
      var timeSeries = undefined;
      var initialValues = this.getVariable().getWrappedObj().initialValues;

      for (var i = 0; i < initialValues.length; i++) {
        if (initialValues[i].value.eClass === 'TimeSeries') {
          timeSeries = initialValues[i].value.value
        }
      }
      return timeSeries;
    }
    return this.timeSeries;
  }


  /**
   * Set the time series for the state variable
   *
   * @command Variable.setTimeSeries()
   * @returns {Object} The state variable
   */
  setTimeSeries (timeSeries) {
    this.timeSeries = timeSeries;
    return this;
  }

  /**
   * Get the initial value for the state variable
   *
   * @command Variable.getInitialValue()
   * @returns {Object} The initial value of the state variable
   */
  getInitialValue () {

    return this.getVariable().getWrappedObj().initialValues;
  }


  /**
   * Get watched
   *
   * @command Variable.getWatched()
   * @returns {boolean} true if this variable is being watched
   */
  isWatched () {
    // NOTE: this.watched is a flag added by this API / Capability
    return this.watched;
  }

  /**
   * Set watched
   *
   * @command Variable.setWatched()
   * @param {Boolean} watched - Object with options attributes to initialize node
   */
  setWatched (isWatched, updateServer) {
    if (updateServer == undefined) {
      updateServer = true;
    }
    if (updateServer && isWatched != this.watched) {
      this.experimentsController.watchVariables([this], isWatched);
    }
    this.watched = isWatched;
    return this;
  }


}

