# sails-generate-raml-scaffolding

A tool for generating Sails models from [RESTful API Modeling Language](http://raml.org/) specification.

This is not intended to produce a working implementation of an API, or even working code in most cases, instead the result is simply meant to serve as a quickstart basis for a new project.

### Features

- creates a model for each RAML resource
- maps formParameters from post actions to model attributes
- if Sails blueprints are configured to pluralize will rename models accordingly
- maps several RAML attribute properties to one recognized by Waterline
- parses RAML resource description field for annotations prefixed by `@wl-`,
  and inserts them in the model attribute definition (see [here](https://github.com/balderdashy/waterline-docs/blob/master/models.md) for supported properties), rest of the description is added as javascript comment

### Planned features

- generating placeholder code for controllers and policies

### Known issues

- identifying resources is naive and is likely to contain issues, e.g. collisions
- practically no validation is done to verify RAML description fields or the code injected in to the model files
- overwrites attributes of existing models if one with same name is parsed from RAML

In other words, be cautious, do not run in a project with uncommitted code of any value.

### Installation

```sh
$ npm install sails-generate-raml-scaffolding
```


### Usage

##### On the command line

```sh
$ sails generate raml-scaffolding ~/api.raml
```



### Development

To get started quickly and see this generator in action, ...

Also see `CONTRIBUTING.md` for more information on overriding/enhancing existing generators.



### Questions?

See `FAQ.md`.



### More Resources

- [Stackoverflow](http://stackoverflow.com/questions/tagged/sails.js)
- [#sailsjs on Freenode](http://webchat.freenode.net/) (IRC channel)
- [Twitter](https://twitter.com/sailsjs)
- [Professional/enterprise](https://github.com/balderdashy/sails-docs/blob/master/FAQ.md#are-there-professional-support-options)
- [Tutorials](https://github.com/balderdashy/sails-docs/blob/master/FAQ.md#where-do-i-get-help)
- <a href="http://sailsjs.org" target="_blank" title="Node.js framework for building realtime APIs."><img src="https://github-camo.global.ssl.fastly.net/9e49073459ed4e0e2687b80eaf515d87b0da4a6b/687474703a2f2f62616c64657264617368792e6769746875622e696f2f7361696c732f696d616765732f6c6f676f2e706e67" width=60 alt="Sails.js logo (small)"/></a>


### License

**[MIT](./LICENSE)**
&copy; 2014 [stt](http://github.com/stt)

As for [Sails](http://sailsjs.org)?  It's free and open-source under the [MIT License](http://sails.mit-license.org/).

![image_squidhome@2x.png](http://i.imgur.com/RIvu9.png)
