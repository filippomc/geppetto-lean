/**
 * Client class use to represent an array type.
 *
 * @module model/ArrayType
 * @author Giovanni Idili
 * @author Matteo Cantarelli
 */

import Type from './Type';

export default class ArrayType extends Type {


  constructor (node, library) {
    super(node, library);
    this.type = node.arrayType;
    this.size = node.size;
  }


  /**
   * Get type for array type
   *
   * @command ArrayType.getType()
   *
   * @returns {Type} - type
   *
   */
  getType () {
    return this.type;
  }

  /**
   * Get array size
   *
   * @command ArrayType.getSize()
   *
   * @returns {int} - size of the array
   *
   */
  getSize () {
    return this.size;
  }


  populateTypeReferences () {
    super.populateTypeReferences();
    const node = this;

    // take array type string - looks like this --> '//@libraries.1/@types.5'
    var arrayType = node.getType();

    if (arrayType !== undefined) {
      var typeObj = node.geppettoModel.resolve(arrayType.$ref);
      node.type = typeObj;
    }

    // resolve super type
    var superType = node.getSuperType();
    if (superType !== undefined) {
      var typeObjs = [];

      // convert to array if single element
      if (!(superType instanceof Array)) {
        superType = [superType];
      }

      for (var a = 0; a < superType.length; a++) {
        if (superType[a].$ref) {
          // replace with reference to actual type
          typeObjs.push(node.geppettoModel.resolve(superType[a].$ref));
        } else {
          // replace with reference to actual type
          typeObjs.push(superType[a]);
        }
      }

      node.superType = typeObjs;
    }
  }
}