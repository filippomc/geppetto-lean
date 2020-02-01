/**
 * Client class use to represent a library that contains a set of types.
 *
 * @module model/Library
 * @author Giovanni Idili
 */

import ObjectWrapper from './ObjectWrapper';
import ImportType from './ImportType';


export default class Library extends ObjectWrapper{

  constructor (options) {
    super(options);
    this.types = (options.types !== 'undefined') ? options.types : [];
    this.importTypes = [];
  }

  /**
   * Get types for this library
   *
   * @command Library.getTypes()
   *
   * @returns {List<Type>} - list of Type objects
   *
   */
  getTypes () {
    return this.types;
  }

  /**
   * Get combined children
   *
   * @command Library.getChildren()
   *
   * @returns {List<Object>} - List of children
   *
   */
  getChildren () {
    return this.types;
  }

  addImportType (importType) {
    this.importTypes.push(importType);
  }

  removeImportType (importType) {
    this.importTypes.remove(importType);
  }

  resolveAllImportTypes (callback) {
    if (this.importTypes.length > 0) {

      var b = [];
      const BATCH = 50;
      for (var i = 0; i < this.importTypes.length; i++) {
        b.push(this.importTypes[i].getPath());
      }
      while (b.length > BATCH) {
        GEPPETTO.Manager.resolveImportType(b.splice(0, BATCH));
      }
      GEPPETTO.Manager.resolveImportType(b, function () {
        if (callback !== undefined) {
          callback();
        }
      });
    }

  }

// Overriding set
  setTypes (types) {

    this.types = types;

    for (var i = 0; i < types.length; i++) {
      if (types[i] instanceof ImportType) {
        this.addImportType(types[i]);
      }
    }

    return this;
  }

// Overriding set
  addType (type) {

    type.setParent(this);

    // add to library in geppetto object model
    this.types.push(type);

    if (type instanceof ImportType) {
      this.addImportType(type);
    }

    return this;
  }
}
