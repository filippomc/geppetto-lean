/**
 * Client class use to represent an instance object (instantiation of a variable).
 *
 * @module model/AVisualCapability
 * @author Giovanni Idili
 */

import Instance from '../model/Instance';
import ArrayInstance from '../model/ArrayInstance';
import Type from '../model/Type';
import Variable from '../model/Variable';
import Resources from '../Resources';

export default class AVisualCapability {
  

  constructor (sceneController, instancesService, eventsService) {
    if (!this.sceneController) {
      throw new Error("sceneController is required.");
    }
    if (!this.instancesService) {
      throw new Error("instancesService is required.");
    }
    if (!this.experimentsController) {
      throw new Error("experimentsController is required.");
    }
    
    this.sceneController = sceneController;
    this.instancesService = instancesService;
    this.eventsService = eventsService;

    this.capabilityId = 'VisualCapability';
    this.visible = true;
    this.selected = false;
  }
  /**
   * Hides the instance or class of instances
   *
   * @command AVisualCapability.hide()
   *
   */
  hide (nested) {
    if (nested === undefined) {
      nested = true;
    }

    if (this instanceof Instance || this instanceof ArrayInstance) {
      this.sceneController.hideInstance(this.getInstancePath());
      this.visible = false;

      if (nested === true && typeof this.getChildren === "function") {
        var children = this.getChildren();
        for (var i = 0; i < children.length; i++) {
          if (typeof children[i].hide === "function") {
            children[i].hide(nested);
          }
        }
      }

      var message = Resources.HIDE_ASPECT + this.getInstancePath();
    } else if (this instanceof Type || this instanceof Variable) {
      // fetch all instances for the given type or variable and call hide on each
      var instances = this.instancesService.getAllInstancesOf(this);
      for (var j = 0; j < instances.length; j++) {
        if (instances[j].hasCapability(this.capabilityId)) {
          instances[j].hide(nested);
        }
      }

      var message = Resources.HIDE_ASPECT + this.getPath();
    }
    this.eventsService.visibilityChanged(this);

    return message;
  }

  /**
   * Shows the instance or class of instances
   *
   * @command AVisualCapability.show()
   *
   */
  show (nested) {
    if (nested === undefined) {
      nested = true;
    }

    if (this instanceof Instance || this instanceof ArrayInstance) {
      this.sceneController.showInstance(this.getInstancePath());
      this.visible = true;

      if (nested === true && typeof this.getChildren === "function") {
        var children = this.getChildren();
        for (var i = 0; i < children.length; i++) {
          if (typeof children[i].show === "function") {
            children[i].show(nested);
          }
        }
      }

      var message = Resources.SHOW_ASPECT + this.getInstancePath();
    } else if (this instanceof Type || this instanceof Variable) {
      // fetch all instances for the given type or variable and call show on each
      var instances = this.instancesService.getAllInstancesOf(this);
      for (var j = 0; j < instances.length; j++) {
        if (instances[j].hasCapability(this.capabilityId)) {
          instances[j].show(nested);
        }
      }

      var message = Resources.HIDE_ASPECT + this.getPath();
    }
    
    this.eventsService.visibilityChanged(this);
    return message;
  }

  /**
   * Returns whether the object is visible or not
   *
   * @command AVisualCapability.isVisible()
   *
   */
  isVisible () {
    return this.visible;
  }

  /**
   * Returns whether the object is selected or not
   *
   * @command AVisualCapability.isSelected()
   *
   */
  isSelected () {
    return this.selected;
  }

  /**
   * Change the opacity of an instance or class of instances
   *
   * @command AVisualCapability.setOpacity(opacity)
   *
   */
  setOpacity (opacity) {

    this.sceneController.setOpacity(this.getInstancePath(), opacity);
  }


  /**
   *
   * @returns {*}
   */
  getColor () {
    return this.sceneController.getColor(this);
  }

  /**
   * Change the color of an instance or class of instances
   *
   * @command AVisualCapability.setColor(color)
   *
   */
  setColor (color) {

    this.sceneController.setColor(this.getInstancePath(), color);

    this.eventsService.colorChanged({ instance: this, color: color });

    return this;
  }

  /**
   * Select the instance or class of instances
   *
   * @command AVisualCapability.select()
   *
   */
  select (nested, geometryIdentifier, point) {
    if (nested === undefined) {
      nested = true;
    }

    var message;

    if (this instanceof Instance || this instanceof ArrayInstance) {
      if (!this.selected) {
        // set selection flag local to the instance and add to geppetto selection list
        this.selected = true;
        this.sceneController.selectInstance(this.getInstancePath(), geometryIdentifier);
        message = Resources.SELECTING_ASPECT + this.getInstancePath();

        // signal selection has changed in simulation pass instance
        this.eventsService.select(this, geometryIdentifier, point);
      } else {
        message = Resources.ASPECT_ALREADY_SELECTED;
      }

      if (nested === true && typeof this.getChildren === "function") {
        var children = this.getChildren();
        for (var i = 0; i < children.length; i++) {
          if (typeof children[i].select === "function") {
            children[i].select(nested, geometryIdentifier, point);
          }
        }
      }
    } else if (this instanceof Type || this instanceof Variable) {
      // fetch all instances for the given type or variable and call hide on each
      var instances = this.instancesService.getAllInstancesOf(this);
      for (var j = 0; j < instances.length; j++) {
        if (instances[j].hasCapability(this.capabilityId)) {
          instances[j].select(nested, geometryIdentifier, point);
        }
      }

      message = Resources.BATCH_SELECTION;
    }

    return message;
  }

  /**
   * Deselects the instance or class of instances
   *
   * @command AVisualCapability.deselect()
   *
   */
  deselect (nested) {
    if (nested === undefined) {
      nested = true;
    }

    var message;

    if (this instanceof Instance || this instanceof ArrayInstance) {
      if (this.selected) {
        message = Resources.DESELECTING_ASPECT + this.getInstancePath();
        this.sceneController.deselectInstance(this.getInstancePath());
        this.selected = false;
        // trigger event that selection has been changed
        this.eventsService.select(this);
      } else {
        message = Resources.ASPECT_NOT_SELECTED;
      }

      // nested
      if (nested === true && typeof this.getChildren === "function") {
        var children = this.getChildren();
        for (var i = 0; i < children.length; i++) {
          if (typeof children[i].deselect === "function") {
            children[i].deselect(nested);
          }
        }
      }
    } else if (this instanceof Type || this instanceof Variable) {
      // fetch all instances for the given type or variable and call hide on each
      var instances = this.instancesService.getAllInstancesOf(this);
      for (var j = 0; j < instances.length; j++) {
        if (instances[j].hasCapability(this.capabilityId)) {
          instances[j].deselect(nested);
        }
      }

      message = Resources.BATCH_DESELECTION;
    }

    return message;
  }

  /**
   * Zooms to instance or class of instances
   *
   * @command AVisualCapability.zoomTo()
   *
   */
  zoomTo () {
    if (this instanceof Instance || this instanceof ArrayInstance) {
      this.sceneController.zoomTo([this]);
      return Resources.ZOOM_TO_ENTITY + this.getInstancePath();
    } else if (this instanceof Type || this instanceof Variable) {
      // fetch all instances for the given type or variable and call hide on each
      var instances = this.instancesService.getAllInstancesOf(this);
      this.sceneController.zoomTo(instances);
    }
    return this;
  }

  /**
   * Set the type of geometry to be used for this aspect
   */
  setGeometryType (type, thickness) {
    this.sceneController.setGeometryType(this, type, thickness);
    return this;
  }

  /**
   * Show connection lines for instances.
   * @param {boolean} mode - Show or hide connection lines
   */
  showConnectionLines (mode) {
    this.sceneController.showConnectionLines(this.getInstancePath(), mode);
    return this;
  }
}

