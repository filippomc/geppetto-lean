import Resources from "../Resources";

export default class GeppettoModelNode {

  constructor (parent) {
    this.parent = parent;
    if (this.parent === undefined) {
      throw new Error("Parent must be specified");
    }
    const geppettoModel = this.findRoot();
    if (geppettoModel && geppettoModel !== this) {
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

  populateShortcutsToChild (child) {
    this[child.getId()] = child;
  }
  /**
   * Populate shortcuts of children onto parents
   */
  populateChildrenShortcuts () {
    // check if getChildren exists, if so add shortcuts based on ids and recurse on each

    for (let child of this.getChildren()) {
      // do not populate shortcuts for array instances - children are accessed as array elements
      this.populateShortcutsToChild(child);
      child.populateChildrenShortcuts();
    }
  }

  /**
   * Resolve connection values
   */
  resolveConnectionValues () {

    // get initial values
    var initialValues = null;
    const connectionInstanceOrVariable = this;
    if (connectionInstanceOrVariable instanceof Instance) {
      initialValues = connectionInstanceOrVariable.getVariable().getWrappedObj().initialValues;
    } else if (connectionInstanceOrVariable.getMetaType() === Resources.VARIABLE_NODE) {
      initialValues = connectionInstanceOrVariable.getWrappedObj().initialValues;
    }

    // get pointer A and pointer B
    var connectionValue = initialValues[0].value;
    // resolve A and B to Pointer Objects
    var pointerA = this.createPointer(connectionValue.a);
    var pointerB = this.createPointer(connectionValue.b);

    if (connectionInstanceOrVariable instanceof Instance) {
      this.augmentPointer(pointerA, connectionInstanceOrVariable);
      this.augmentPointer(pointerB, connectionInstanceOrVariable);
    }

    // set A and B on connection
    connectionInstanceOrVariable.setA(pointerA);
    connectionInstanceOrVariable.setB(pointerB);
  }



  isStatic () {
    return false;
  }

}
