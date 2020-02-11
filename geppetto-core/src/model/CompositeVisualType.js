/**
 * Client class use to represent a composite type.
 *
 * @module model/CompositeVisualType
 * @author Giovanni Idili
 */

import CompositeType from './CompositeType';

export default class CompositeVisualType extends CompositeType {

  constructor (node, library) {
    super(node, library);
    this.visualGroups = node.visualGroups ? node.visualGroups : [];
  }

  /**
   * Get the visual groups
   *
   * @command CompositeVisualType.getVisualGroups()
   *
   * @returns {List<VisualGroup>} - List of variables
   *
   */
  getVisualGroups () {
    return this.visualGroups;
  }

  /**
   * Get combined children
   *
   * @command CompositeType.getChildren()
   *
   * @returns {List<Object>} - List of children
   *
   */
  getChildren () {
    var vg = this.visualGroups;
    if (vg) {
      return this.variables.concat(vg);
    } else {
      return this.variables;
    }

  }
}