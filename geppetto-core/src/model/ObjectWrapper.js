import GeppettoModelNode from './GeppettoModelNode';

/**
 * Base class that provides wrapping functionality for a generic underlying object (with id and name).
 *
 * @module model/ObjectWrapper
 * @author Giovanni Idili
 */

export default class ObjectWrapper extends GeppettoModelNode{

  constructor (options) {
    super(options.parent);
    this.wrappedObj = options.wrappedObj;
  }


  /**
   * Gets the name of the node
   *
   * @command Node.getName()
   * @returns {String} Name of the node
   *
   */
  getName () {
    return this.wrappedObj.name;
  }

  /**
   * Get the id associated with node
   *
   * @command Node.getId()
   * @returns {String} ID of node
   */
  getId () {
    return this.wrappedObj.id;
  }

  /**
   * Get the wrapped obj
   *
   * @command Node.getWrappedObj()
   * @returns {Object} - Wrapped object
   */
  getWrappedObj () {
    return this.wrappedObj;
  }

  /**
   * Get meta type
   *
   * @command Instance.getMetaType()
   *
   * @returns {String} - meta type
   *
   */
  getMetaType () {
    return this.wrappedObj.eClass;
  }



  /**
   * Get path
   *
   * @command Type.getPath()
   *
   * @returns {String} - path
   *
   */
  getPath () {
    if (this.parent) {
      return this.parent.getPath() + "." + this.getId();
    } else {
      return this.getId();
    }

  }
}

