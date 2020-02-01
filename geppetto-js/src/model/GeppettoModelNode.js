

export default class GeppettoModelNode {

  constructor (parent) {
    this.parent = parent;
    if (this.parent === undefined) {
      throw new Error("Parent must be specified");
    }
    const geppettoModel = this.findRoot();
    if (geppettoModel && geppettoModel != this) {
      this.geppettoModel = geppettoModel;
    }

  }


  /**
   * Find root instance
   */
  findRoot () {
    if (this.parent === null) {
      return this;
    }
    return this.parent.findRoot();
  }

  /**
   * Get parent
   *
   * @command Type.getParent()
   *
   * @returns {Object} - Parent object
   *
   */
  getParent () {
    return this.parent;
  }

  /**
   * Set parent
   *
   * @command Type.setParent()
   *
   * @returns {Object} - Current object
   *
   */
  setParent (parent) {
    this.parent = parent;
    return this;
  }

  /**
   * Populate connections
   */
  populateConnections () {
    this.getChildren().forEach(child => child.populateConnections());
  }


  getChildren () {
    return [];
  }

  getTypes () {
    return [];
  }

  /**
   * Populate type references
   */
  populateTypeReferences () {
    this.getChildren().forEach(child => child.populateTypeReferences());
  }

}