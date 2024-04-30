/* https://d19ujuohqco9tx.cloudfront.net/webwidgets/7-49-1-9/en-au/widget-api.js */

(function (root) {
  var sw, appSettings, globalStyles;

  root.shortcuts = root.shortcuts || {};
  sw = root.shortcuts.widgets = {};
  sw.mobile = {};
  sw.web = {};
  sw.settings = {
    dateFormat: "d MMM yyyy",
  };

  sw.isDebug = false;

  appSettings = {
    version: "",
    apiUrl: null,
    widgetUrl: null,
    enableRegistrationCode: null,
    enableBookingOnBehalf: null,
    siteId: null,
    companyUrl: null,
    consumerKey: null,
    consumerSecret: null,
    widgetCredential: null,
    defaultStylesEnabled: true,
    fbAppId: -1,
    fbCallback: null,
    accessToken: null,
    accessTokenType: null,
    paymentGatewayUrl: null,
    authenticationUrl: null,
    apiLambdaBaseUrl: null,
    debug: false,
    debugSites: [],
  };

  /**
   * JWT Token
   * @type {null}
   */
  jwtToken = null;

  /**
   * Return JWT Token Deferred Object
   * @returns {Deferred}
   */
  function requestJWTToken() {
    var accessCredentials = {
      accessToken: sw.getAppSetting("accessToken"),
      accessTokenSecret: sw.getAppSetting("accessTokenSecret"),
    };

    var deferred = $.Deferred();

    const cb = function () {
      $.ajax({
        url: sw.getAppSetting("authenticationUrl"),
        type: "POST",
        data: JSON.stringify({
          credential_type_code: "oauth",
        }),
        processData: false,
        contentType: "application/json; charset=utf-8",
        beforeSend: function (jqXHR, ajaxOptions) {
          sw.security.OAuth.sign(jqXHR, ajaxOptions, accessCredentials);
        },
      }).then(
        function (data) {
          jwtToken = data.access_token;
          deferred.resolve(jwtToken);
        },
        function (err) {
          deferred.reject();
        }
      );
    };

    if (jwtToken) {
      const jwtDecode = sw.vendor.jwt_decode(jwtToken);
      const expiry = jwtDecode.exp;
      if (sw.vendor.moment(expiry * 1000).isAfter(sw.vendor.moment())) {
        setTimeout(function () {
          deferred.resolve(jwtToken);
        }, 100);
      } else {
        cb();
      }
    } else {
      cb();
    }

    return deferred.promise();
  }

  /**
   * Converts a camel case property name to a dash seperated string a la css.
   * @param {string} value The name to convert
   * @returns {string} The converted string.
   */
  function camelCaseToCss(value) {
    var regex = /([A-Z])/;
    return value.replace(regex, "-$1").toLowerCase();
  }

  /**
   * Converts a hash of css rules into a semi-colon seperated string that can be consumed by
   * CSSStyleSheet.addRule
   * @param {object} rules Hash of css rules.
   * @returns {string} string of css rules
   */
  function rulesToString(rules) {
    var property,
      result = "";
    for (property in rules) {
      if (!rules.hasOwnProperty(property)) {
        continue;
      }

      if (typeof rules[property] !== "object") {
        result += camelCaseToCss(property) + ":" + rules[property] + "; ";
      } else {
        result +=
          camelCaseToCss(property) + "{" + rulesToString(rules[property]) + "}";
      }
    }

    return result;
  }

  sw.ajaxSigned = function (url, accessCredentials, options) {
    var opts;
    opts = options || {};
    opts.beforeSend = function (jqXHR, ajaxOptions) {
      sw.security.OAuth.sign(jqXHR, ajaxOptions, accessCredentials);
    };
    return $.ajax(url, opts);
  };

  /**
   * Creates an empty style tag in the head of the document.
   * @param {boolean} isGlobal whether to use this as the global stylesheet.
   * @returns {CSSStyleSheet} The style sheet associated with the style element.
   */
  sw.createStyleSheet = function (isGlobal) {
    var parent, style;
    // Return if this has been called before.
    if (isGlobal && globalStyles) {
      sw.removeStyles();
    }

    // Create a style tag and add it to the document.
    style = document.createElement("style");
    style.appendChild(document.createTextNode(""));
    style.setAttribute("title", "sw-style");
    parent = document.getElementsByTagName("head")[0];
    if (!parent) {
      parent = document.getElementsByTagName("html")[0];
    }
    parent.appendChild(style);

    if (isGlobal) globalStyles = style;

    return style;
  };

  /**
   * Adds a hash of styles to the global stylesheet.
   * @param {DOMElement} styleEl style element, or NULL to use the global rules.
   * @param {object} styles The styles.
   */
  sw.addStyles = function (styleEl, styles) {
    for (var selector in styles) {
      if (!styles.hasOwnProperty(selector)) {
        continue;
      }
      sw.addStyleRule(styleEl, selector, styles[selector]);
    }
  };

  /**
   * Removes a hash of styles from the global stylesheet.
   * @param {DOMElement} styleEl style element, or NULL to use the global rules.
   */
  sw.removeStyles = function (styleEl) {
    if (styleEl) {
      $(styleEl).remove();
    } else if (globalStyles) {
      globalStyles.parentNode.removeChild(globalStyles);
      globalStyles = null;
    }
  };

  /**
   * Add a rule to the styles.
   * @param {DOMElement} styleEl style element, or NULL to use the global rules.
   * @param {string} selector css selector for the style.
   * @param {object} rules hash of css properties and values to apply to the selector.
   */
  sw.addStyleRule = function (styleEl, selector, rules) {
    var stylesheet = styleEl ? styleEl.sheet : globalStyles.sheet;

    if (stylesheet.addRule) {
      stylesheet.addRule(selector, rulesToString(rules));
    } else if (stylesheet.insertRule) {
      stylesheet.insertRule(
        selector + "{" + rulesToString(rules) + "}",
        (stylesheet.rules || stylesheet.cssRules).length
      );
    }
  };

  /**************************************************
   *
   *   =>    This is the STARTING POINT            <=
   *
   ***************************************************/
  sw.init = function (settings) {
    // Map/Copy all settings properties to sw.settings
    for (var prop in settings) {
      if (sw.settings.hasOwnProperty(prop)) {
        sw.settings[prop] = settings[prop];
      }
    }

    var protocol;
    protocol =
      sw.vendor._.indexOf(["http", "https"], settings.protocol) !== -1
        ? settings.protocol + "://"
        : document.location.protocol == "https:"
        ? "https://"
        : "http://";
    appSettings.apiUrl = protocol + settings.apiUrl;
    appSettings.widgetUrl = protocol + settings.widgetUrl;
    appSettings.fbCallback = protocol + settings.fbCallback;
    appSettings.enableBookingOnBehalf = settings.enableBookingOnBehalf;
    appSettings.paymentGatewayUrl = settings["paymentGatewayUrl"];
    appSettings.authenticationUrl = settings["authenticationUrl"];
    appSettings.apiLambdaBaseUrl = settings["apiLambdaBaseUrl"];

    if (settings.version) {
      appSettings.version = settings.version.split(".").splice(0, 3).join(".");
    }
    // Trim white space from any templates, as a bug in jQuery 1.9.1 stops this from working.
    if (settings.widgetTemplates) {
      sw.vendor._.each(settings.widgetTemplates, function (templates) {
        var key;
        for (key in templates) {
          if (!templates.hasOwnProperty(key)) {
            continue;
          }

          if (templates[key] && sw.vendor._.isFunction(templates[key].trim)) {
            templates[key] = templates[key].trim();
          }

          if (!templates[key]) {
            console.error("Null/empty template given for " + key);
          }
        }
      });
    }

    sw.vendor._.extend(
      appSettings,
      sw.vendor._.omit(settings, [
        "apiUrl",
        "widgetUrl",
        "version",
        "fbCallback",
      ])
    );

    if (appSettings.fbAppId) {
      sw.vendor.openFB.init({
        appId: appSettings.fbAppId,
        tokenStore: window.localStorage,
      });
    }

    $.ajax("https://d19ujuohqco9tx.cloudfront.net/salonapp/log.json").then(
      function (res) {
        if (
          (appSettings.debug != null && appSettings.debug == true) ||
          res.debug == true
        ) {
          // enable the log
          sw.isDebug = true;
        } else {
          sw.isDebug = false;
          sw.vendor.log4javascript.setEnabled(false); // turn it off
        }

        if (res.debugSites && res.debugSites.length > 0) {
          $.each(res.debugSites, function (i, o) {
            sw.getAppSetting("debugSites").push(o);
          });
        }

        // setting up root logger
        var logger = sw.vendor.log4javascript.getRootLogger();
        // var appender = new sw.vendor.log4javascript.PopUpAppender();
        var appender = new sw.vendor.log4javascript.AjaxAppender(res.logServer);
        appender.addHeader("Content-Type", "application/json");
        var popUpLayout = new sw.vendor.log4javascript.JsonLayout(true);
        appender.setLayout(popUpLayout);
        logger.addAppender(appender);
      },
      function (err) {
        sw.isDebug = false;
      }
    );

    return $.Deferred().resolve();
  };

  sw.setAccessTokenDetails = function (accessToken, accessTokenType) {
    appSettings.accessToken = accessToken;
    appSettings.accessTokenType = accessTokenType;
  };

  sw.ensureSiteDetailsInCache = function (siteId, forceReload) {
    var firstWidgetKey, firstWidgetCredential, site, deferred;

    firstWidgetKey = sw.vendor._.keys(appSettings.widgetCredential)[0];
    firstWidgetCredential = appSettings.widgetCredential[firstWidgetKey];

    site = sw.cache.stateCache.get(siteId, "site");
    if (
      forceReload === true ||
      sw.vendor._.isEmpty(site) ||
      !site.company_url ||
      !site.regional_settings
    ) {
      deferred = $.when(
        sw.handlers.getApiUrl
          .call({ siteId: siteId }, "site")
          .then(function (url) {
            return sw.ajaxSigned(
              url,
              {
                accessToken: firstWidgetCredential.accessToken,
                accessTokenSecret: firstWidgetCredential.accessTokenSecret,
              },
              { data: { fields: "links,description" } }
            );
          })
          .then(function (data) {
            sw.vendor._.extend(site, sw.vendor._.omit(data, "links"));
            site.company_url = sw.vendor._.find(data.links, function (link) {
              return link.rel === "resource/company";
            }).href;

            site.companyId = site.company_url.substring(
              site.company_url.lastIndexOf("/") + 1,
              site.company_url.length
            );
          }),

        sw.handlers.getApiUrl
          .call({ siteId: siteId }, "site", "configuration")
          .then(function (url) {
            return sw.ajaxSigned(
              url,
              {
                accessToken: firstWidgetCredential.accessToken,
                accessTokenSecret: firstWidgetCredential.accessTokenSecret,
              },
              {
                data: {
                  fields:
                    "online_payment,privacy_policy,is_accept_data_privacy_policy,is_upfront_payment_active,is_sms_configured,appointment_book,is_online_booking_enabled,is_online_queue_enabled,regional_settings,online_booking,tax,business,walkin_manager,use_insecure_logins,skip_registration_code,customer_card,employee_label_name,show_contact_text,is_cancellation_fee_enabled,is_online_payment_enabled",
                },
              }
            );
          })
          .then(function (data) {
            //
            // English (United Arab Emirates) en-AE is a special case custom culture.
            // If the site culture is set to en-AE then it needs to be explicitely loaded
            // so that its currency symbol is available.
            //
            if (data.regional_settings.culture_code.toLowerCase() === "en-ae") {
              sw.vendor.Globalize.addCultureInfo("en-AE", "default", {
                name: "en-AE",
                englishName: "English (United Arab Emirates)",
                nativeName: "English (United Arab Emirates)",
                numberFormat: {
                  currency: {
                    pattern: ["-$n", "$n"],
                    symbol: "",
                  },
                },
                calendars: {
                  standard: {
                    firstDay: 1,
                    patterns: {
                      d: "d/MM/yyyy",
                      D: "dddd, d MMMM yyyy",
                      f: "dddd, d MMMM yyyy h:mm tt",
                      F: "dddd, d MMMM yyyy h:mm:ss tt",
                      M: "dd MMMM",
                      Y: "MMMM yyyy",
                    },
                  },
                },
              });
            }

            appSettings.providerUrl = data.online_payment.provider_client_uri;
            appSettings.paymentProviderKey =
              data.online_payment.payment_provider_publishable_key;
            appSettings.paymentProviderEnvironment =
              data.online_payment.payment_provider_extended_data.environment;

            site.regional_settings = {};
            site.online_booking = {};
            site.tax = {};
            site.walkin_manager = {};
            site.appointment_book = {};
            site.customer_card = {};
            var defaultCulture = "en-AU";
            sw.vendor._.extend(
              site.regional_settings,
              sw.vendor._.omit(data.regional_settings, "href")
            );
            sw.vendor._.extend(
              site.online_booking,
              sw.vendor._.omit(data.online_booking, "href")
            );
            sw.vendor._.extend(site.tax, sw.vendor._.omit(data.tax, "href"));
            sw.vendor._.extend(site, sw.vendor._.omit(data.business, "href"));
            sw.vendor._.extend(
              site.walkin_manager,
              sw.vendor._.omit(data.walkin_manager, "href")
            );
            sw.vendor._.extend(
              site.appointment_book,
              sw.vendor._.omit(data.appointment_book, "href")
            );
            sw.vendor._.extend(
              site.customer_card,
              sw.vendor._.omit(data.customer_card, "href")
            );
            site.is_online_booking_enabled = data.is_online_booking_enabled;
            site.is_online_queue_enabled = data.is_online_queue_enabled;
            site.use_insecure_logins = data.use_insecure_logins == true;
            site.skip_registration_code = data.skip_registration_code == true;
            site.employee_label_name = data.employee_label_name;
            site.is_sms_configured = data.is_sms_configured;
            site.is_upfront_payment_active = data.is_upfront_payment_active;
            site.is_cancellation_fee_enabled = data.is_cancellation_fee_enabled;
            site.is_online_payment_enabled = data.is_online_payment_enabled;
            site.is_accept_data_privacy_policy =
              data.is_accept_data_privacy_policy;
            site.privacy_policy = data.privacy_policy;
            site.show_contact_text = data.show_contact_text;
            site.payment_provider_code =
              data.online_payment.payment_provider_code;
            sw.vendor.Globalize.culture(
              !site.regional_settings.culture_code
                ? defaultCulture
                : site.regional_settings.culture_code
            );
            sw.vendor.moment.locale(
              !site.regional_settings.culture_code
                ? defaultCulture
                : site.regional_settings.culture_code
            );

            //patch the accounting.js locale data
            var globalizeCurrency =
              sw.vendor.Globalize.culture().numberFormat.currency;
            var accountingCurrency = sw.vendor.accounting.settings.currency;
            accountingCurrency.symbol = globalizeCurrency.symbol;
            accountingCurrency.decimal = globalizeCurrency["."];
            accountingCurrency.thousand = globalizeCurrency[","];
            accountingCurrency.format = globalizeCurrency.pattern[
              globalizeCurrency.pattern.length - 1
            ]
              .replace("n", "%v")
              .replace("$", "%s");
          })
      );
    } else {
      deferred = $.Deferred().resolve();
    }
    return deferred;
  };

  sw.getSiteDateTime = function (siteId) {
    var site = sw.cache.stateCache.get(siteId, "site");
    var moment = sw.vendor.moment();
    if (sw.vendor._.isNumber(site.timezone_utc_offset_hours))
      moment.zone(-site.timezone_utc_offset_hours);

    return moment;
  };

  sw.getApiUrl = function () {
    return appSettings.apiUrl;
  };

  sw.getWidgetUrl = function () {
    return appSettings.widgetUrl;
  };

  sw.getEnableRegistrationCode = function () {
    return appSettings.enableRegistrationCode;
  };

  sw.getEnableBookingOnBehalf = function () {
    return appSettings.enableBookingOnBehalf;
  };

  sw.isStripeConfigured = function () {
    return !!appSettings.paymentGatewayUrl;
  };

  sw.getFacebookCallbackUrl = function () {
    return appSettings.fbCallback;
  };

  sw.getAppSetting = function (key) {
    var props, i, result;
    props = key.split(".");
    for (i = 0; i < props.length; i++) {
      result = sw.vendor._.isObject(result)
        ? result[props[i]]
        : appSettings[props[i]];
    }
    return result;
  };

  /**
   * Gets app settings that are specific to a certain widget, and will
   * read from * if that has settings and the widget doesn't.
   * @param key The app settings key to read
   * @param widgetName The name of the widget to look into
   */
  sw.getWidgetSpecificAppSetting = function (key, widgetName) {
    var settings, result, searchKeys, searchObj, _;
    settings = sw.getAppSetting(key);
    _ = sw.vendor._;

    searchKeys = [widgetName, "*"];
    result = {};

    if (!settings) return null;

    for (var i = 0; i < searchKeys.length; i++) {
      searchObj = settings[searchKeys[i]];

      // Return early if we have a simple type or jquery
      if (
        !_.isUndefined(searchObj) &&
        (!_.isObject(searchObj) || searchObj instanceof jQuery)
      )
        return searchObj;

      // Build up an object with the widget-specific settings first, then
      // the * settings afterwards
      _.defaults(result, searchObj);
    }

    if (_.isEmpty(result)) return null;

    return result;
  };

  function recursiveExtend(obj, defaultsObj, isOverride) {
    var omissions = [defaultsObj];

    for (var defaultKey in defaultsObj) {
      if (
        sw.vendor._.isObject(obj[defaultKey]) &&
        !sw.vendor._.isFunction(obj[defaultKey]) &&
        !sw.vendor._.isArray(obj[defaultKey])
      ) {
        // Recursively enter a javascript object to apply defaults
        recursiveExtend(obj[defaultKey], defaultsObj[defaultKey], isOverride);
        omissions.push(defaultKey);
      }
    }

    // Omit all objects that we recursively extended above
    defaultsObj = sw.vendor._.omit.apply(this, omissions);
    sw.vendor._[isOverride ? "extend" : "defaults"](obj, defaultsObj);
    return obj;
  }

  // Modules are re-usable parts of widgets.
  // Any props passed here before a registerWidget will be added to the widget when registerWidget is called
  var widgetModules = {};
  sw.registerModule = function (props) {
    widgetModules = recursiveExtend(widgetModules, props, true);
  };

  sw.registerWidget = function (props) {
    var widgetExtender,
      widget,
      getCredential,
      buildRequestOptions,
      parseError,
      widgetRequest,
      widgetBaseClose,
      widgetClose,
      widgetTemplates;
    widgetExtender = sw.getWidgetSpecificAppSetting(
      "widgetExtraProperties",
      sw._currentPath
    );
    widget = sw.vendor._.extend({}, sw.vendor, props, widgetExtender);
    widget.isClosed = false;
    widget.$el = sw._currentEl;
    widget.path = sw._currentPath;
    widget.siteId = sw._currentSiteId;
    widget.binder = sw.bindings.DataBinder;

    // Prevent recursive extend from being able to make any difference to sw.strings,
    // otherwise titles will step on each other's toes.
    var swStrings = sw.vendor._.extend({}, sw.strings);
    recursiveExtend(widget, { strings: swStrings }, false);
    recursiveExtend(widget, widgetModules, false);
    sw.vendor._.defaults(widget, sw.handlers);
    widgetModules = {};

    getLogger = function () {
      if (sw.isDebug) {
        var interestedSites = sw.getAppSetting("debugSites")
          ? sw.getAppSetting("debugSites")
          : [];
        if (
          interestedSites.indexOf("*") != -1 ||
          interestedSites.indexOf(parseInt(widget.siteId)) != -1
        ) {
          return sw.vendor.log4javascript.getLogger(
            widget.path.replace("/", ".")
          );
        }
      }

      return sw.vendor.log4javascript.getNullLogger();
    };

    getCredential = function () {
      var result = sw.getWidgetSpecificAppSetting(
        "widgetCredential",
        sw._currentPath
      );
      if (!result) {
        throw "Credential not found for '" + sw._currentPath + "'";
      }

      return result;
    };

    buildRequestOptions = function (type, data) {
      var options;
      options = {
        type: type,
        contentType: "application/json",
      };
      if (data) options.data = data;
      return options;
    };

    /**
     * Convert an error object from an XHR response in to an object we can use, including a displayable message.
     * @param {widget} widget Widget the error originated from.  We use the strings associated with the widget.
     * @param {jqHXR} jqXHR The response.
     * @returns {object} The parsed out error object
     */
    parseError = function (widget, jqXHR) {
      var error, ex, innerError, i, message;

      /**
       * Checks an error object for any sub codes and looks up any assoicated messages.
       * @param {object} error
       * @returns {string} The error message gleaned from subcodes, if any.
       */
      function parseErrorSubcodes(error) {
        var i, j, messages, errors;

        if (!widget || !widget.strings || !widget.strings.error_codes) {
          return;
        }

        messages = [];

        errors = error.errors ? error.errors : [error];

        for (i = 0; i < errors.length; i++) {
          if (!errors[i].sub_codes) {
            continue;
          }

          for (j = 0; j < errors[i].sub_codes.length; j++) {
            messages.push(widget.strings.error_codes[errors[i].sub_codes[j]]);
          }
        }

        return messages.join(" | ");
      }

      error = {};
      error.status = jqXHR.status;
      if (
        error.status === 500 ||
        error.status === 400 ||
        error.status === 503 ||
        error.status === 409
      ) {
        try {
          sw.vendor._.extend(error, JSON.parse(jqXHR.responseText));

          // Try parsing out the subcodes first for specific errors.
          error.message = parseErrorSubcodes(error);
          if (error.message) {
            return error;
          }

          // If no known sub_codes provided, use the error_type_code.
          if (error.errors instanceof Array && error.errors.length > 0) {
            error.message = "";
            for (i = 0; i < error.errors.length; i++) {
              innerError = error.errors[i];
              if (innerError.error_type_code === "system") {
                error.message = sw.strings.systemError;
                break;
              } else if (error.error_type_code !== "validation") {
                message =
                  innerError.message ||
                  (error.status === 500
                    ? sw.strings.systemError
                    : sw.strings.unauthorisedError);
                if (i != 0) error.message += "\n";
                error.message += innerError.message;
              }
            }
          } else {
            if (error.status === 400 && error.code === "InvalidVersion") {
              error.message = sw.strings.invalidVersion;
            } else if (error.error_type_code === "system") {
              error.message = sw.strings.systemError;
            } else if (error.error_type_code === "offline") {
              error.title = sw.strings.siteOfflineErrorTitle;
              error.message = sw.strings.siteOfflineError;
            } else if (error.error_type_code !== "validation") {
              message =
                error.status === 500
                  ? sw.strings.systemError
                  : sw.strings.unauthorisedError;
              error.message = message;
            }
          }
        } catch (_error) {
          ex = _error;
          error.message = sw.strings.systemError;
        }
      } else if (error.status === 403) {
        error.message = sw.strings.unauthorisedError;
      } else if (error.status === 401) {
        error.message = sw.strings.sessionTimeout;
      } else {
        error.message = sw.strings.systemError;
      }
      return error;
    };

    /**
     * Make an AJAX/HTTP request and handle any errors that arise from it.
     * @param widget The widget the request originated from.
     * @param url The address to make the request to.
     * @param credentials Credentials required
     * @param {object} options Options accepted by the jquery.ajax call.
     * @param {object} config Options used for our internal purposes.
     * @returns {$.Deferred} Resolved or rejected when the response comes back, includes data included with the response
     */
    widgetRequest = function (widget, url, credentials, options, config) {
      var deferred;
      deferred = $.Deferred();

      var request = sw
        .ajaxSigned(url, credentials, options)
        .done(function (data, textStatus, jqXHR) {
          if (widget.isClosed) {
            jqXHR.abort();
          } else {
            deferred.resolve(data, textStatus, jqXHR);
          }
        })
        .fail(function (jqXHR, textStatus, errorThrown) {
          try {
            getLogger().debug(
              JSON.stringify({
                requestUrl: url,
                requestPayload: options,
                responsePayload: jqXHR.responseJSON,
                responseStatusCode: jqXHR.status,
                responseHeaders: jqXHR
                  .getAllResponseHeaders()
                  .replace(/\r\n/g, ";"),
                siteId: widget.siteId,
              })
            );
          } catch (e) {
            // purposely ignore this exception. Don't curse me!
            console.error(e);
          }

          if (widget.isClosed && textStatus != "abort") {
            jqXHR.abort();
          } else if (textStatus !== "abort") {
            var error;
            deferred.reject(jqXHR, textStatus, errorThrown);

            if (jqXHR.global === false) {
              return;
            }

            error = parseError(widget, jqXHR);
            widget.showAlert(error.message, error.title);
          }
        });

      // global indicates whether any error will be handled by the global error handler or at the individual call level.
      request.global = config && config.global;

      return deferred.promise();
    };

    sw.cache.widgetCache.set(sw._currentSiteId, sw._currentPath, widget);

    widget.signedGet = (function (credentials, widget) {
      return function (url, data, bypassCache, config) {
        var options;

        if (bypassCache) {
          options = buildRequestOptions("GET", data || null);
          return widgetRequest(widget, url, credentials, options, config);
        } else {
          return sw.preloading.read(
            url,
            data,
            credentials,
            sw.vendor._.partial(widgetRequest, widget),
            config
          );
        }
      };
    })(getCredential(), widget);

    widget.signedPost = (function (credentials, widget) {
      return function (url, data, config) {
        var options;
        options = buildRequestOptions(
          "POST",
          data ? JSON.stringify(data) : null
        );
        return widgetRequest(widget, url, credentials, options, config);
      };
    })(getCredential(), widget);

    widget.signedPut = (function (credentials, widget) {
      return function (url, data, config) {
        var options;
        options = buildRequestOptions(
          "PUT",
          data ? JSON.stringify(data) : null
        );
        return widgetRequest(widget, url, credentials, options, config);
      };
    })(getCredential(), widget);

    widget.signedDelete = (function (credentials, widget) {
      return function (url, data, config) {
        var options;
        options = buildRequestOptions(
          "DELETE",
          data ? JSON.stringify(data) : null
        );
        return widgetRequest(widget, url, credentials, options, config);
      };
    })(getCredential(), widget);

    widget.getImageData = (function (credentials) {
      return function (apiPath) {
        return sw.getImageData(apiPath, credentials);
      };
    })(getCredential());

    widget.uploadImageToApi = (function (credentials) {
      return function (apiPath, imageData, orientation) {
        return sw.uploadImageToApi(
          apiPath,
          imageData,
          credentials,
          orientation
        );
      };
    })(getCredential());

    if (sw.getAppSetting("defaultStylesEnabled") && widget.styles) {
      widget._cssStylesEl = sw.createStyleSheet(false);
      sw.addStyles(widget._cssStylesEl, widget.styles);
    }

    // Convenience functions for widgets to read/write into the global state cache, by the
    // correct site id
    widget.getState = function (key) {
      return sw.cache.stateCache.get(this.siteId, key);
    };
    widget.setState = function (key, value) {
      return sw.cache.stateCache.set(this.siteId, key, value);
    };
    widget.removeState = function (key) {
      return sw.cache.stateCache.remove(this.siteId, key);
    };

    widget.getSiteDateTime = function () {
      return sw.getSiteDateTime(this.siteId);
    };

    widget.lambdaAPIService = function (lambdaPath, httpMethod, data) {
      const _this = this;
      const apiLambdaBaseUrl = sw.getAppSetting("apiLambdaBaseUrl");
      this.onBeginRequest();

      return requestJWTToken().pipe(function (jwtToken) {
        return $.ajax(apiLambdaBaseUrl + "/" + lambdaPath, {
          dataType: "json",
          contentType: "application/json",
          data: httpMethod === "GET" ? data : JSON.stringify(data),
          headers: {
            password: "1234",
            Authorization: "JWT " + jwtToken,
            siteid: _this.siteId,
          }, // TODO: FIX ME !!!!!!! don't know why the APIs require this password
          method: httpMethod,
        }).fail(function (jqXhr) {
          try {
            getLogger().debug(
              JSON.stringify({
                requestUrl: apiLambdaBaseUrl + "/" + lambdaPath,
                responsePayload: jqXhr.responseJSON,
                responseStatusCode: jqXhr.status,
                responseHeaders: jqXhr
                  .getAllResponseHeaders()
                  .replace(/\r\n/g, ";"),
                siteId: widget.siteId,
              })
            );
          } catch (e) {
            // purposely ignore this exception. Don't curse me!
            console.log(e);
          }

          console.error(
            jqXhr.responseJSON ? jqXhr.responseJSON.message : jqXhr.statusText
          );
          _this.onEndRequest();
        });
      });
    };

    if (!sw.vendor._.isFunction(widget.load))
      widget.load = function () {
        return $.Deferred().resolve(this);
      }.bind(widget);

    if (!sw.vendor._.isFunction(widget.render))
      widget.render = function () {
        return this;
      }.bind(widget);

    if (!sw.vendor._.isFunction(widget.resize))
      widget.resize = function () {
        return this;
      }.bind(widget);

    widgetBaseClose = function () {
      this.isClosed = true;
      this.binder.undelegateEvents(widget);
      this.$el.removeData();
      this.$el.find("*").removeData().remove();
      if (sw.getAppSetting("defaultStylesEnabled") && this._cssStylesEl) {
        sw.removeStyles(this._cssStylesEl);
      }
      return this;
    };

    if (!sw.vendor._.isFunction(widget.close)) {
      widget.close = widgetBaseClose.bind(widget);
    } else {
      widgetClose = widget.close;
      widget.close = function () {
        widgetClose.call(widget);
        widgetBaseClose.call(widget);
      };
    }

    if (!sw.vendor._.isFunction(widget.onResume))
      widget.onResume = function () {
        return this;
      }.bind(widget);

    if (!sw.vendor._.isFunction(widget.getBackSetting))
      widget.getBackSetting = function () {
        return sw.BACK_NORMAL;
      }.bind(widget);

    // Allow the parent webpage to override the templates in any widget they want
    widgetTemplates = sw.getWidgetSpecificAppSetting(
      "widgetTemplates",
      sw._currentPath
    );
    if (widgetTemplates) {
      for (var templateName in widgetTemplates) {
        if (widgetTemplates.hasOwnProperty(templateName)) {
          var overriddenTemplate;
          // Don't use _.result, as that changes the context of the called function. The embedder
          // may want to have their own context (with .bind()) to a function that gets passed in.
          if (sw.vendor._.isFunction(widgetTemplates[templateName]))
            overriddenTemplate = widgetTemplates[templateName](
              sw._currentEl,
              sw._currentPath
            );
          else overriddenTemplate = widgetTemplates[templateName];

          if (overriddenTemplate) {
            sw._currentEl
              .find(
                "script[type='text/x-shortcuts-template'][data-sw-id='" +
                  templateName +
                  "']"
              )
              .text(overriddenTemplate);
          }
        }
      }
    }

    return widget;
  };

  sw.jwtToken = function () {
    var accessCredentials = {
      accessToken: sw.getAppSetting("accessToken"),
      accessTokenSecret: sw.getAppSetting("accessTokenSecret"),
    };

    const appSetting = sw.getAppSetting("authenticationUrl");
    return $.ajax({
      url: appSetting,
      type: "POST",
      data: JSON.stringify({
        credential_type_code: "oauth",
      }),
      processData: false,
      contentType: "application/json; charset=utf-8",
      beforeSend: function (jqXHR, ajaxOptions) {
        sw.security.OAuth.sign(jqXHR, ajaxOptions, accessCredentials);
      },
    });
  };

  sw.BACK_NORMAL = 0; // Creates a back history entry as normal when loaded
  sw.BACK_CLEAR_PREVIOUS = 1; // Creates a back history entry and removes all previous entries
  sw.BACK_CLEAR_PREVIOUS_UPON_ADDITION = 2; // Creates a back history entry and removes all before us, when another entry is added after us
  sw.BACK_NONE = 3; // Doesn't create a back history entry
})(this);

(function (root) {
  /*
CryptoJS v3.1.2
code.google.com/p/crypto-js
(c) 2009-2013 by Jeff Mott. All rights reserved.
code.google.com/p/crypto-js/wiki/License
*/
  var CryptoJS =
    CryptoJS ||
    (function (h, r) {
      var k = {},
        l = (k.lib = {}),
        n = function () {},
        f = (l.Base = {
          extend: function (a) {
            n.prototype = this;
            var b = new n();
            a && b.mixIn(a);
            b.hasOwnProperty("init") ||
              (b.init = function () {
                b.$super.init.apply(this, arguments);
              });
            b.init.prototype = b;
            b.$super = this;
            return b;
          },
          create: function () {
            var a = this.extend();
            a.init.apply(a, arguments);
            return a;
          },
          init: function () {},
          mixIn: function (a) {
            for (var b in a) a.hasOwnProperty(b) && (this[b] = a[b]);
            a.hasOwnProperty("toString") && (this.toString = a.toString);
          },
          clone: function () {
            return this.init.prototype.extend(this);
          },
        }),
        j = (l.WordArray = f.extend({
          init: function (a, b) {
            a = this.words = a || [];
            this.sigBytes = b != r ? b : 4 * a.length;
          },
          toString: function (a) {
            return (a || s).stringify(this);
          },
          concat: function (a) {
            var b = this.words,
              d = a.words,
              c = this.sigBytes;
            a = a.sigBytes;
            this.clamp();
            if (c % 4)
              for (var e = 0; e < a; e++)
                b[(c + e) >>> 2] |=
                  ((d[e >>> 2] >>> (24 - 8 * (e % 4))) & 255) <<
                  (24 - 8 * ((c + e) % 4));
            else if (65535 < d.length)
              for (e = 0; e < a; e += 4) b[(c + e) >>> 2] = d[e >>> 2];
            else b.push.apply(b, d);
            this.sigBytes += a;
            return this;
          },
          clamp: function () {
            var a = this.words,
              b = this.sigBytes;
            a[b >>> 2] &= 4294967295 << (32 - 8 * (b % 4));
            a.length = h.ceil(b / 4);
          },
          clone: function () {
            var a = f.clone.call(this);
            a.words = this.words.slice(0);
            return a;
          },
          random: function (a) {
            for (var b = [], d = 0; d < a; d += 4)
              b.push((4294967296 * h.random()) | 0);
            return new j.init(b, a);
          },
        })),
        m = (k.enc = {}),
        s = (m.Hex = {
          stringify: function (a) {
            var b = a.words;
            a = a.sigBytes;
            for (var d = [], c = 0; c < a; c++) {
              var e = (b[c >>> 2] >>> (24 - 8 * (c % 4))) & 255;
              d.push((e >>> 4).toString(16));
              d.push((e & 15).toString(16));
            }
            return d.join("");
          },
          parse: function (a) {
            for (var b = a.length, d = [], c = 0; c < b; c += 2)
              d[c >>> 3] |= parseInt(a.substr(c, 2), 16) << (24 - 4 * (c % 8));
            return new j.init(d, b / 2);
          },
        }),
        p = (m.Latin1 = {
          stringify: function (a) {
            var b = a.words;
            a = a.sigBytes;
            for (var d = [], c = 0; c < a; c++)
              d.push(
                String.fromCharCode((b[c >>> 2] >>> (24 - 8 * (c % 4))) & 255)
              );
            return d.join("");
          },
          parse: function (a) {
            for (var b = a.length, d = [], c = 0; c < b; c++)
              d[c >>> 2] |= (a.charCodeAt(c) & 255) << (24 - 8 * (c % 4));
            return new j.init(d, b);
          },
        }),
        t = (m.Utf8 = {
          stringify: function (a) {
            try {
              return decodeURIComponent(escape(p.stringify(a)));
            } catch (b) {
              throw Error("Malformed UTF-8 data");
            }
          },
          parse: function (a) {
            return p.parse(unescape(encodeURIComponent(a)));
          },
        }),
        q = (l.BufferedBlockAlgorithm = f.extend({
          reset: function () {
            this._data = new j.init();
            this._nDataBytes = 0;
          },
          _append: function (a) {
            "string" == typeof a && (a = t.parse(a));
            this._data.concat(a);
            this._nDataBytes += a.sigBytes;
          },
          _process: function (a) {
            var b = this._data,
              d = b.words,
              c = b.sigBytes,
              e = this.blockSize,
              f = c / (4 * e),
              f = a ? h.ceil(f) : h.max((f | 0) - this._minBufferSize, 0);
            a = f * e;
            c = h.min(4 * a, c);
            if (a) {
              for (var g = 0; g < a; g += e) this._doProcessBlock(d, g);
              g = d.splice(0, a);
              b.sigBytes -= c;
            }
            return new j.init(g, c);
          },
          clone: function () {
            var a = f.clone.call(this);
            a._data = this._data.clone();
            return a;
          },
          _minBufferSize: 0,
        }));
      l.Hasher = q.extend({
        cfg: f.extend(),
        init: function (a) {
          this.cfg = this.cfg.extend(a);
          this.reset();
        },
        reset: function () {
          q.reset.call(this);
          this._doReset();
        },
        update: function (a) {
          this._append(a);
          this._process();
          return this;
        },
        finalize: function (a) {
          a && this._append(a);
          return this._doFinalize();
        },
        blockSize: 16,
        _createHelper: function (a) {
          return function (b, d) {
            return new a.init(d).finalize(b);
          };
        },
        _createHmacHelper: function (a) {
          return function (b, d) {
            return new u.HMAC.init(a, d).finalize(b);
          };
        },
      });
      var u = (k.algo = {});
      return k;
    })(Math);

  this.CryptoJS = CryptoJS;
  /*
CryptoJS v3.1.2
code.google.com/p/crypto-js
(c) 2009-2013 by Jeff Mott. All rights reserved.
code.google.com/p/crypto-js/wiki/License
*/
  (function () {
    var c = CryptoJS,
      k = c.enc.Utf8;
    c.algo.HMAC = c.lib.Base.extend({
      init: function (a, b) {
        a = this._hasher = new a.init();
        "string" == typeof b && (b = k.parse(b));
        var c = a.blockSize,
          e = 4 * c;
        b.sigBytes > e && (b = a.finalize(b));
        b.clamp();
        for (
          var f = (this._oKey = b.clone()),
            g = (this._iKey = b.clone()),
            h = f.words,
            j = g.words,
            d = 0;
          d < c;
          d++
        )
          (h[d] ^= 1549556828), (j[d] ^= 909522486);
        f.sigBytes = g.sigBytes = e;
        this.reset();
      },
      reset: function () {
        var a = this._hasher;
        a.reset();
        a.update(this._iKey);
      },
      update: function (a) {
        this._hasher.update(a);
        return this;
      },
      finalize: function (a) {
        var b = this._hasher;
        a = b.finalize(a);
        b.reset();
        return b.finalize(this._oKey.clone().concat(a));
      },
    });
  })();

  /*
CryptoJS v3.1.2
code.google.com/p/crypto-js
(c) 2009-2013 by Jeff Mott. All rights reserved.
code.google.com/p/crypto-js/wiki/License
*/
  (function () {
    var k = CryptoJS,
      b = k.lib,
      m = b.WordArray,
      l = b.Hasher,
      d = [],
      b = (k.algo.SHA1 = l.extend({
        _doReset: function () {
          this._hash = new m.init([
            1732584193, 4023233417, 2562383102, 271733878, 3285377520,
          ]);
        },
        _doProcessBlock: function (n, p) {
          for (
            var a = this._hash.words,
              e = a[0],
              f = a[1],
              h = a[2],
              j = a[3],
              b = a[4],
              c = 0;
            80 > c;
            c++
          ) {
            if (16 > c) d[c] = n[p + c] | 0;
            else {
              var g = d[c - 3] ^ d[c - 8] ^ d[c - 14] ^ d[c - 16];
              d[c] = (g << 1) | (g >>> 31);
            }
            g = ((e << 5) | (e >>> 27)) + b + d[c];
            g =
              20 > c
                ? g + (((f & h) | (~f & j)) + 1518500249)
                : 40 > c
                ? g + ((f ^ h ^ j) + 1859775393)
                : 60 > c
                ? g + (((f & h) | (f & j) | (h & j)) - 1894007588)
                : g + ((f ^ h ^ j) - 899497514);
            b = j;
            j = h;
            h = (f << 30) | (f >>> 2);
            f = e;
            e = g;
          }
          a[0] = (a[0] + e) | 0;
          a[1] = (a[1] + f) | 0;
          a[2] = (a[2] + h) | 0;
          a[3] = (a[3] + j) | 0;
          a[4] = (a[4] + b) | 0;
        },
        _doFinalize: function () {
          var b = this._data,
            d = b.words,
            a = 8 * this._nDataBytes,
            e = 8 * b.sigBytes;
          d[e >>> 5] |= 128 << (24 - (e % 32));
          d[(((e + 64) >>> 9) << 4) + 14] = Math.floor(a / 4294967296);
          d[(((e + 64) >>> 9) << 4) + 15] = a;
          b.sigBytes = 4 * d.length;
          this._process();
          return this._hash;
        },
        clone: function () {
          var b = l.clone.call(this);
          b._hash = this._hash.clone();
          return b;
        },
      }));
    k.SHA1 = l._createHelper(b);
    k.HmacSHA1 = l._createHmacHelper(b);
  })();

  /*
CryptoJS v3.1.2
code.google.com/p/crypto-js
(c) 2009-2013 by Jeff Mott. All rights reserved.
code.google.com/p/crypto-js/wiki/License
*/
  (function () {
    var h = CryptoJS,
      j = h.lib.WordArray;
    h.enc.Base64 = {
      stringify: function (b) {
        var e = b.words,
          f = b.sigBytes,
          c = this._map;
        b.clamp();
        b = [];
        for (var a = 0; a < f; a += 3)
          for (
            var d =
                (((e[a >>> 2] >>> (24 - 8 * (a % 4))) & 255) << 16) |
                (((e[(a + 1) >>> 2] >>> (24 - 8 * ((a + 1) % 4))) & 255) << 8) |
                ((e[(a + 2) >>> 2] >>> (24 - 8 * ((a + 2) % 4))) & 255),
              g = 0;
            4 > g && a + 0.75 * g < f;
            g++
          )
            b.push(c.charAt((d >>> (6 * (3 - g))) & 63));
        if ((e = c.charAt(64))) for (; b.length % 4; ) b.push(e);
        return b.join("");
      },
      parse: function (b) {
        var e = b.length,
          f = this._map,
          c = f.charAt(64);
        c && ((c = b.indexOf(c)), -1 != c && (e = c));
        for (var c = [], a = 0, d = 0; d < e; d++)
          if (d % 4) {
            var g = f.indexOf(b.charAt(d - 1)) << (2 * (d % 4)),
              h = f.indexOf(b.charAt(d)) >>> (6 - 2 * (d % 4));
            c[a >>> 2] |= (g | h) << (24 - 8 * (a % 4));
            a++;
          }
        return j.create(c, a);
      },
      _map: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",
    };
  })();

  //     Underscore.js 1.8.3
  //     http://underscorejs.org
  //     (c) 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
  //     Underscore may be freely distributed under the MIT license.
  (function () {
    function n(n) {
      function t(t, r, e, u, i, o) {
        for (; i >= 0 && o > i; i += n) {
          var a = u ? u[i] : i;
          e = r(e, t[a], a, t);
        }
        return e;
      }
      return function (r, e, u, i) {
        e = b(e, i, 4);
        var o = !k(r) && m.keys(r),
          a = (o || r).length,
          c = n > 0 ? 0 : a - 1;
        return (
          arguments.length < 3 && ((u = r[o ? o[c] : c]), (c += n)),
          t(r, e, u, o, c, a)
        );
      };
    }
    function t(n) {
      return function (t, r, e) {
        r = x(r, e);
        for (var u = O(t), i = n > 0 ? 0 : u - 1; i >= 0 && u > i; i += n)
          if (r(t[i], i, t)) return i;
        return -1;
      };
    }
    function r(n, t, r) {
      return function (e, u, i) {
        var o = 0,
          a = O(e);
        if ("number" == typeof i)
          n > 0
            ? (o = i >= 0 ? i : Math.max(i + a, o))
            : (a = i >= 0 ? Math.min(i + 1, a) : i + a + 1);
        else if (r && i && a) return (i = r(e, u)), e[i] === u ? i : -1;
        if (u !== u)
          return (i = t(l.call(e, o, a), m.isNaN)), i >= 0 ? i + o : -1;
        for (i = n > 0 ? o : a - 1; i >= 0 && a > i; i += n)
          if (e[i] === u) return i;
        return -1;
      };
    }
    function e(n, t) {
      var r = I.length,
        e = n.constructor,
        u = (m.isFunction(e) && e.prototype) || a,
        i = "constructor";
      for (m.has(n, i) && !m.contains(t, i) && t.push(i); r--; )
        (i = I[r]), i in n && n[i] !== u[i] && !m.contains(t, i) && t.push(i);
    }
    var u = this,
      i = u._,
      o = Array.prototype,
      a = Object.prototype,
      c = Function.prototype,
      f = o.push,
      l = o.slice,
      s = a.toString,
      p = a.hasOwnProperty,
      h = Array.isArray,
      v = Object.keys,
      g = c.bind,
      y = Object.create,
      d = function () {},
      m = function (n) {
        return n instanceof m
          ? n
          : this instanceof m
          ? void (this._wrapped = n)
          : new m(n);
      };
    "undefined" != typeof exports
      ? ("undefined" != typeof module &&
          module.exports &&
          (exports = module.exports = m),
        (exports._ = m))
      : (u._ = m),
      (m.VERSION = "1.8.3");
    var b = function (n, t, r) {
        if (t === void 0) return n;
        switch (null == r ? 3 : r) {
          case 1:
            return function (r) {
              return n.call(t, r);
            };
          case 2:
            return function (r, e) {
              return n.call(t, r, e);
            };
          case 3:
            return function (r, e, u) {
              return n.call(t, r, e, u);
            };
          case 4:
            return function (r, e, u, i) {
              return n.call(t, r, e, u, i);
            };
        }
        return function () {
          return n.apply(t, arguments);
        };
      },
      x = function (n, t, r) {
        return null == n
          ? m.identity
          : m.isFunction(n)
          ? b(n, t, r)
          : m.isObject(n)
          ? m.matcher(n)
          : m.property(n);
      };
    m.iteratee = function (n, t) {
      return x(n, t, 1 / 0);
    };
    var _ = function (n, t) {
        return function (r) {
          var e = arguments.length;
          if (2 > e || null == r) return r;
          for (var u = 1; e > u; u++)
            for (
              var i = arguments[u], o = n(i), a = o.length, c = 0;
              a > c;
              c++
            ) {
              var f = o[c];
              (t && r[f] !== void 0) || (r[f] = i[f]);
            }
          return r;
        };
      },
      j = function (n) {
        if (!m.isObject(n)) return {};
        if (y) return y(n);
        d.prototype = n;
        var t = new d();
        return (d.prototype = null), t;
      },
      w = function (n) {
        return function (t) {
          return null == t ? void 0 : t[n];
        };
      },
      A = Math.pow(2, 53) - 1,
      O = w("length"),
      k = function (n) {
        var t = O(n);
        return "number" == typeof t && t >= 0 && A >= t;
      };
    (m.each = m.forEach =
      function (n, t, r) {
        t = b(t, r);
        var e, u;
        if (k(n)) for (e = 0, u = n.length; u > e; e++) t(n[e], e, n);
        else {
          var i = m.keys(n);
          for (e = 0, u = i.length; u > e; e++) t(n[i[e]], i[e], n);
        }
        return n;
      }),
      (m.map = m.collect =
        function (n, t, r) {
          t = x(t, r);
          for (
            var e = !k(n) && m.keys(n),
              u = (e || n).length,
              i = Array(u),
              o = 0;
            u > o;
            o++
          ) {
            var a = e ? e[o] : o;
            i[o] = t(n[a], a, n);
          }
          return i;
        }),
      (m.reduce = m.foldl = m.inject = n(1)),
      (m.reduceRight = m.foldr = n(-1)),
      (m.find = m.detect =
        function (n, t, r) {
          var e;
          return (
            (e = k(n) ? m.findIndex(n, t, r) : m.findKey(n, t, r)),
            e !== void 0 && e !== -1 ? n[e] : void 0
          );
        }),
      (m.filter = m.select =
        function (n, t, r) {
          var e = [];
          return (
            (t = x(t, r)),
            m.each(n, function (n, r, u) {
              t(n, r, u) && e.push(n);
            }),
            e
          );
        }),
      (m.reject = function (n, t, r) {
        return m.filter(n, m.negate(x(t)), r);
      }),
      (m.every = m.all =
        function (n, t, r) {
          t = x(t, r);
          for (
            var e = !k(n) && m.keys(n), u = (e || n).length, i = 0;
            u > i;
            i++
          ) {
            var o = e ? e[i] : i;
            if (!t(n[o], o, n)) return !1;
          }
          return !0;
        }),
      (m.some = m.any =
        function (n, t, r) {
          t = x(t, r);
          for (
            var e = !k(n) && m.keys(n), u = (e || n).length, i = 0;
            u > i;
            i++
          ) {
            var o = e ? e[i] : i;
            if (t(n[o], o, n)) return !0;
          }
          return !1;
        }),
      (m.contains =
        m.includes =
        m.include =
          function (n, t, r, e) {
            return (
              k(n) || (n = m.values(n)),
              ("number" != typeof r || e) && (r = 0),
              m.indexOf(n, t, r) >= 0
            );
          }),
      (m.invoke = function (n, t) {
        var r = l.call(arguments, 2),
          e = m.isFunction(t);
        return m.map(n, function (n) {
          var u = e ? t : n[t];
          return null == u ? u : u.apply(n, r);
        });
      }),
      (m.pluck = function (n, t) {
        return m.map(n, m.property(t));
      }),
      (m.where = function (n, t) {
        return m.filter(n, m.matcher(t));
      }),
      (m.findWhere = function (n, t) {
        return m.find(n, m.matcher(t));
      }),
      (m.max = function (n, t, r) {
        var e,
          u,
          i = -1 / 0,
          o = -1 / 0;
        if (null == t && null != n) {
          n = k(n) ? n : m.values(n);
          for (var a = 0, c = n.length; c > a; a++)
            (e = n[a]), e > i && (i = e);
        } else
          (t = x(t, r)),
            m.each(n, function (n, r, e) {
              (u = t(n, r, e)),
                (u > o || (u === -1 / 0 && i === -1 / 0)) && ((i = n), (o = u));
            });
        return i;
      }),
      (m.min = function (n, t, r) {
        var e,
          u,
          i = 1 / 0,
          o = 1 / 0;
        if (null == t && null != n) {
          n = k(n) ? n : m.values(n);
          for (var a = 0, c = n.length; c > a; a++)
            (e = n[a]), i > e && (i = e);
        } else
          (t = x(t, r)),
            m.each(n, function (n, r, e) {
              (u = t(n, r, e)),
                (o > u || (1 / 0 === u && 1 / 0 === i)) && ((i = n), (o = u));
            });
        return i;
      }),
      (m.shuffle = function (n) {
        for (
          var t, r = k(n) ? n : m.values(n), e = r.length, u = Array(e), i = 0;
          e > i;
          i++
        )
          (t = m.random(0, i)), t !== i && (u[i] = u[t]), (u[t] = r[i]);
        return u;
      }),
      (m.sample = function (n, t, r) {
        return null == t || r
          ? (k(n) || (n = m.values(n)), n[m.random(n.length - 1)])
          : m.shuffle(n).slice(0, Math.max(0, t));
      }),
      (m.sortBy = function (n, t, r) {
        return (
          (t = x(t, r)),
          m.pluck(
            m
              .map(n, function (n, r, e) {
                return { value: n, index: r, criteria: t(n, r, e) };
              })
              .sort(function (n, t) {
                var r = n.criteria,
                  e = t.criteria;
                if (r !== e) {
                  if (r > e || r === void 0) return 1;
                  if (e > r || e === void 0) return -1;
                }
                return n.index - t.index;
              }),
            "value"
          )
        );
      });
    var F = function (n) {
      return function (t, r, e) {
        var u = {};
        return (
          (r = x(r, e)),
          m.each(t, function (e, i) {
            var o = r(e, i, t);
            n(u, e, o);
          }),
          u
        );
      };
    };
    (m.groupBy = F(function (n, t, r) {
      m.has(n, r) ? n[r].push(t) : (n[r] = [t]);
    })),
      (m.indexBy = F(function (n, t, r) {
        n[r] = t;
      })),
      (m.countBy = F(function (n, t, r) {
        m.has(n, r) ? n[r]++ : (n[r] = 1);
      })),
      (m.toArray = function (n) {
        return n
          ? m.isArray(n)
            ? l.call(n)
            : k(n)
            ? m.map(n, m.identity)
            : m.values(n)
          : [];
      }),
      (m.size = function (n) {
        return null == n ? 0 : k(n) ? n.length : m.keys(n).length;
      }),
      (m.partition = function (n, t, r) {
        t = x(t, r);
        var e = [],
          u = [];
        return (
          m.each(n, function (n, r, i) {
            (t(n, r, i) ? e : u).push(n);
          }),
          [e, u]
        );
      }),
      (m.first =
        m.head =
        m.take =
          function (n, t, r) {
            return null == n
              ? void 0
              : null == t || r
              ? n[0]
              : m.initial(n, n.length - t);
          }),
      (m.initial = function (n, t, r) {
        return l.call(n, 0, Math.max(0, n.length - (null == t || r ? 1 : t)));
      }),
      (m.last = function (n, t, r) {
        return null == n
          ? void 0
          : null == t || r
          ? n[n.length - 1]
          : m.rest(n, Math.max(0, n.length - t));
      }),
      (m.rest =
        m.tail =
        m.drop =
          function (n, t, r) {
            return l.call(n, null == t || r ? 1 : t);
          }),
      (m.compact = function (n) {
        return m.filter(n, m.identity);
      });
    var S = function (n, t, r, e) {
      for (var u = [], i = 0, o = e || 0, a = O(n); a > o; o++) {
        var c = n[o];
        if (k(c) && (m.isArray(c) || m.isArguments(c))) {
          t || (c = S(c, t, r));
          var f = 0,
            l = c.length;
          for (u.length += l; l > f; ) u[i++] = c[f++];
        } else r || (u[i++] = c);
      }
      return u;
    };
    (m.flatten = function (n, t) {
      return S(n, t, !1);
    }),
      (m.without = function (n) {
        return m.difference(n, l.call(arguments, 1));
      }),
      (m.uniq = m.unique =
        function (n, t, r, e) {
          m.isBoolean(t) || ((e = r), (r = t), (t = !1)),
            null != r && (r = x(r, e));
          for (var u = [], i = [], o = 0, a = O(n); a > o; o++) {
            var c = n[o],
              f = r ? r(c, o, n) : c;
            t
              ? ((o && i === f) || u.push(c), (i = f))
              : r
              ? m.contains(i, f) || (i.push(f), u.push(c))
              : m.contains(u, c) || u.push(c);
          }
          return u;
        }),
      (m.union = function () {
        return m.uniq(S(arguments, !0, !0));
      }),
      (m.intersection = function (n) {
        for (var t = [], r = arguments.length, e = 0, u = O(n); u > e; e++) {
          var i = n[e];
          if (!m.contains(t, i)) {
            for (var o = 1; r > o && m.contains(arguments[o], i); o++);
            o === r && t.push(i);
          }
        }
        return t;
      }),
      (m.difference = function (n) {
        var t = S(arguments, !0, !0, 1);
        return m.filter(n, function (n) {
          return !m.contains(t, n);
        });
      }),
      (m.zip = function () {
        return m.unzip(arguments);
      }),
      (m.unzip = function (n) {
        for (
          var t = (n && m.max(n, O).length) || 0, r = Array(t), e = 0;
          t > e;
          e++
        )
          r[e] = m.pluck(n, e);
        return r;
      }),
      (m.object = function (n, t) {
        for (var r = {}, e = 0, u = O(n); u > e; e++)
          t ? (r[n[e]] = t[e]) : (r[n[e][0]] = n[e][1]);
        return r;
      }),
      (m.findIndex = t(1)),
      (m.findLastIndex = t(-1)),
      (m.sortedIndex = function (n, t, r, e) {
        r = x(r, e, 1);
        for (var u = r(t), i = 0, o = O(n); o > i; ) {
          var a = Math.floor((i + o) / 2);
          r(n[a]) < u ? (i = a + 1) : (o = a);
        }
        return i;
      }),
      (m.indexOf = r(1, m.findIndex, m.sortedIndex)),
      (m.lastIndexOf = r(-1, m.findLastIndex)),
      (m.range = function (n, t, r) {
        null == t && ((t = n || 0), (n = 0)), (r = r || 1);
        for (
          var e = Math.max(Math.ceil((t - n) / r), 0), u = Array(e), i = 0;
          e > i;
          i++, n += r
        )
          u[i] = n;
        return u;
      });
    var E = function (n, t, r, e, u) {
      if (!(e instanceof t)) return n.apply(r, u);
      var i = j(n.prototype),
        o = n.apply(i, u);
      return m.isObject(o) ? o : i;
    };
    (m.bind = function (n, t) {
      if (g && n.bind === g) return g.apply(n, l.call(arguments, 1));
      if (!m.isFunction(n))
        throw new TypeError("Bind must be called on a function");
      var r = l.call(arguments, 2),
        e = function () {
          return E(n, e, t, this, r.concat(l.call(arguments)));
        };
      return e;
    }),
      (m.partial = function (n) {
        var t = l.call(arguments, 1),
          r = function () {
            for (var e = 0, u = t.length, i = Array(u), o = 0; u > o; o++)
              i[o] = t[o] === m ? arguments[e++] : t[o];
            for (; e < arguments.length; ) i.push(arguments[e++]);
            return E(n, r, this, this, i);
          };
        return r;
      }),
      (m.bindAll = function (n) {
        var t,
          r,
          e = arguments.length;
        if (1 >= e) throw new Error("bindAll must be passed function names");
        for (t = 1; e > t; t++) (r = arguments[t]), (n[r] = m.bind(n[r], n));
        return n;
      }),
      (m.memoize = function (n, t) {
        var r = function (e) {
          var u = r.cache,
            i = "" + (t ? t.apply(this, arguments) : e);
          return m.has(u, i) || (u[i] = n.apply(this, arguments)), u[i];
        };
        return (r.cache = {}), r;
      }),
      (m.delay = function (n, t) {
        var r = l.call(arguments, 2);
        return setTimeout(function () {
          return n.apply(null, r);
        }, t);
      }),
      (m.defer = m.partial(m.delay, m, 1)),
      (m.throttle = function (n, t, r) {
        var e,
          u,
          i,
          o = null,
          a = 0;
        r || (r = {});
        var c = function () {
          (a = r.leading === !1 ? 0 : m.now()),
            (o = null),
            (i = n.apply(e, u)),
            o || (e = u = null);
        };
        return function () {
          var f = m.now();
          a || r.leading !== !1 || (a = f);
          var l = t - (f - a);
          return (
            (e = this),
            (u = arguments),
            0 >= l || l > t
              ? (o && (clearTimeout(o), (o = null)),
                (a = f),
                (i = n.apply(e, u)),
                o || (e = u = null))
              : o || r.trailing === !1 || (o = setTimeout(c, l)),
            i
          );
        };
      }),
      (m.debounce = function (n, t, r) {
        var e,
          u,
          i,
          o,
          a,
          c = function () {
            var f = m.now() - o;
            t > f && f >= 0
              ? (e = setTimeout(c, t - f))
              : ((e = null), r || ((a = n.apply(i, u)), e || (i = u = null)));
          };
        return function () {
          (i = this), (u = arguments), (o = m.now());
          var f = r && !e;
          return (
            e || (e = setTimeout(c, t)),
            f && ((a = n.apply(i, u)), (i = u = null)),
            a
          );
        };
      }),
      (m.wrap = function (n, t) {
        return m.partial(t, n);
      }),
      (m.negate = function (n) {
        return function () {
          return !n.apply(this, arguments);
        };
      }),
      (m.compose = function () {
        var n = arguments,
          t = n.length - 1;
        return function () {
          for (var r = t, e = n[t].apply(this, arguments); r--; )
            e = n[r].call(this, e);
          return e;
        };
      }),
      (m.after = function (n, t) {
        return function () {
          return --n < 1 ? t.apply(this, arguments) : void 0;
        };
      }),
      (m.before = function (n, t) {
        var r;
        return function () {
          return (
            --n > 0 && (r = t.apply(this, arguments)), 1 >= n && (t = null), r
          );
        };
      }),
      (m.once = m.partial(m.before, 2));
    var M = !{ toString: null }.propertyIsEnumerable("toString"),
      I = [
        "valueOf",
        "isPrototypeOf",
        "toString",
        "propertyIsEnumerable",
        "hasOwnProperty",
        "toLocaleString",
      ];
    (m.keys = function (n) {
      if (!m.isObject(n)) return [];
      if (v) return v(n);
      var t = [];
      for (var r in n) m.has(n, r) && t.push(r);
      return M && e(n, t), t;
    }),
      (m.allKeys = function (n) {
        if (!m.isObject(n)) return [];
        var t = [];
        for (var r in n) t.push(r);
        return M && e(n, t), t;
      }),
      (m.values = function (n) {
        for (var t = m.keys(n), r = t.length, e = Array(r), u = 0; r > u; u++)
          e[u] = n[t[u]];
        return e;
      }),
      (m.mapObject = function (n, t, r) {
        t = x(t, r);
        for (var e, u = m.keys(n), i = u.length, o = {}, a = 0; i > a; a++)
          (e = u[a]), (o[e] = t(n[e], e, n));
        return o;
      }),
      (m.pairs = function (n) {
        for (var t = m.keys(n), r = t.length, e = Array(r), u = 0; r > u; u++)
          e[u] = [t[u], n[t[u]]];
        return e;
      }),
      (m.invert = function (n) {
        for (var t = {}, r = m.keys(n), e = 0, u = r.length; u > e; e++)
          t[n[r[e]]] = r[e];
        return t;
      }),
      (m.functions = m.methods =
        function (n) {
          var t = [];
          for (var r in n) m.isFunction(n[r]) && t.push(r);
          return t.sort();
        }),
      (m.extend = _(m.allKeys)),
      (m.extendOwn = m.assign = _(m.keys)),
      (m.findKey = function (n, t, r) {
        t = x(t, r);
        for (var e, u = m.keys(n), i = 0, o = u.length; o > i; i++)
          if (((e = u[i]), t(n[e], e, n))) return e;
      }),
      (m.pick = function (n, t, r) {
        var e,
          u,
          i = {},
          o = n;
        if (null == o) return i;
        m.isFunction(t)
          ? ((u = m.allKeys(o)), (e = b(t, r)))
          : ((u = S(arguments, !1, !1, 1)),
            (e = function (n, t, r) {
              return t in r;
            }),
            (o = Object(o)));
        for (var a = 0, c = u.length; c > a; a++) {
          var f = u[a],
            l = o[f];
          e(l, f, o) && (i[f] = l);
        }
        return i;
      }),
      (m.omit = function (n, t, r) {
        if (m.isFunction(t)) t = m.negate(t);
        else {
          var e = m.map(S(arguments, !1, !1, 1), String);
          t = function (n, t) {
            return !m.contains(e, t);
          };
        }
        return m.pick(n, t, r);
      }),
      (m.defaults = _(m.allKeys, !0)),
      (m.create = function (n, t) {
        var r = j(n);
        return t && m.extendOwn(r, t), r;
      }),
      (m.clone = function (n) {
        return m.isObject(n) ? (m.isArray(n) ? n.slice() : m.extend({}, n)) : n;
      }),
      (m.tap = function (n, t) {
        return t(n), n;
      }),
      (m.isMatch = function (n, t) {
        var r = m.keys(t),
          e = r.length;
        if (null == n) return !e;
        for (var u = Object(n), i = 0; e > i; i++) {
          var o = r[i];
          if (t[o] !== u[o] || !(o in u)) return !1;
        }
        return !0;
      });
    var N = function (n, t, r, e) {
      if (n === t) return 0 !== n || 1 / n === 1 / t;
      if (null == n || null == t) return n === t;
      n instanceof m && (n = n._wrapped), t instanceof m && (t = t._wrapped);
      var u = s.call(n);
      if (u !== s.call(t)) return !1;
      switch (u) {
        case "[object RegExp]":
        case "[object String]":
          return "" + n == "" + t;
        case "[object Number]":
          return +n !== +n
            ? +t !== +t
            : 0 === +n
            ? 1 / +n === 1 / t
            : +n === +t;
        case "[object Date]":
        case "[object Boolean]":
          return +n === +t;
      }
      var i = "[object Array]" === u;
      if (!i) {
        if ("object" != typeof n || "object" != typeof t) return !1;
        var o = n.constructor,
          a = t.constructor;
        if (
          o !== a &&
          !(
            m.isFunction(o) &&
            o instanceof o &&
            m.isFunction(a) &&
            a instanceof a
          ) &&
          "constructor" in n &&
          "constructor" in t
        )
          return !1;
      }
      (r = r || []), (e = e || []);
      for (var c = r.length; c--; ) if (r[c] === n) return e[c] === t;
      if ((r.push(n), e.push(t), i)) {
        if (((c = n.length), c !== t.length)) return !1;
        for (; c--; ) if (!N(n[c], t[c], r, e)) return !1;
      } else {
        var f,
          l = m.keys(n);
        if (((c = l.length), m.keys(t).length !== c)) return !1;
        for (; c--; )
          if (((f = l[c]), !m.has(t, f) || !N(n[f], t[f], r, e))) return !1;
      }
      return r.pop(), e.pop(), !0;
    };
    (m.isEqual = function (n, t) {
      return N(n, t);
    }),
      (m.isEmpty = function (n) {
        return null == n
          ? !0
          : k(n) && (m.isArray(n) || m.isString(n) || m.isArguments(n))
          ? 0 === n.length
          : 0 === m.keys(n).length;
      }),
      (m.isElement = function (n) {
        return !(!n || 1 !== n.nodeType);
      }),
      (m.isArray =
        h ||
        function (n) {
          return "[object Array]" === s.call(n);
        }),
      (m.isObject = function (n) {
        var t = typeof n;
        return "function" === t || ("object" === t && !!n);
      }),
      m.each(
        [
          "Arguments",
          "Function",
          "String",
          "Number",
          "Date",
          "RegExp",
          "Error",
        ],
        function (n) {
          m["is" + n] = function (t) {
            return s.call(t) === "[object " + n + "]";
          };
        }
      ),
      m.isArguments(arguments) ||
        (m.isArguments = function (n) {
          return m.has(n, "callee");
        }),
      "function" != typeof /./ &&
        "object" != typeof Int8Array &&
        (m.isFunction = function (n) {
          return "function" == typeof n || !1;
        }),
      (m.isFinite = function (n) {
        return isFinite(n) && !isNaN(parseFloat(n));
      }),
      (m.isNaN = function (n) {
        return m.isNumber(n) && n !== +n;
      }),
      (m.isBoolean = function (n) {
        return n === !0 || n === !1 || "[object Boolean]" === s.call(n);
      }),
      (m.isNull = function (n) {
        return null === n;
      }),
      (m.isUndefined = function (n) {
        return n === void 0;
      }),
      (m.has = function (n, t) {
        return null != n && p.call(n, t);
      }),
      (m.noConflict = function () {
        return (u._ = i), this;
      }),
      (m.identity = function (n) {
        return n;
      }),
      (m.constant = function (n) {
        return function () {
          return n;
        };
      }),
      (m.noop = function () {}),
      (m.property = w),
      (m.propertyOf = function (n) {
        return null == n
          ? function () {}
          : function (t) {
              return n[t];
            };
      }),
      (m.matcher = m.matches =
        function (n) {
          return (
            (n = m.extendOwn({}, n)),
            function (t) {
              return m.isMatch(t, n);
            }
          );
        }),
      (m.times = function (n, t, r) {
        var e = Array(Math.max(0, n));
        t = b(t, r, 1);
        for (var u = 0; n > u; u++) e[u] = t(u);
        return e;
      }),
      (m.random = function (n, t) {
        return (
          null == t && ((t = n), (n = 0)),
          n + Math.floor(Math.random() * (t - n + 1))
        );
      }),
      (m.now =
        Date.now ||
        function () {
          return new Date().getTime();
        });
    var B = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#x27;",
        "`": "&#x60;",
      },
      T = m.invert(B),
      R = function (n) {
        var t = function (t) {
            return n[t];
          },
          r = "(?:" + m.keys(n).join("|") + ")",
          e = RegExp(r),
          u = RegExp(r, "g");
        return function (n) {
          return (n = null == n ? "" : "" + n), e.test(n) ? n.replace(u, t) : n;
        };
      };
    (m.escape = R(B)),
      (m.unescape = R(T)),
      (m.result = function (n, t, r) {
        var e = null == n ? void 0 : n[t];
        return e === void 0 && (e = r), m.isFunction(e) ? e.call(n) : e;
      });
    var q = 0;
    (m.uniqueId = function (n) {
      var t = ++q + "";
      return n ? n + t : t;
    }),
      (m.templateSettings = {
        evaluate: /<%([\s\S]+?)%>/g,
        interpolate: /<%=([\s\S]+?)%>/g,
        escape: /<%-([\s\S]+?)%>/g,
      });
    var K = /(.)^/,
      z = {
        "'": "'",
        "\\": "\\",
        "\r": "r",
        "\n": "n",
        "\u2028": "u2028",
        "\u2029": "u2029",
      },
      D = /\\|'|\r|\n|\u2028|\u2029/g,
      L = function (n) {
        return "\\" + z[n];
      };
    (m.template = function (n, t, r) {
      !t && r && (t = r), (t = m.defaults({}, t, m.templateSettings));
      var e = RegExp(
          [
            (t.escape || K).source,
            (t.interpolate || K).source,
            (t.evaluate || K).source,
          ].join("|") + "|$",
          "g"
        ),
        u = 0,
        i = "__p+='";
      n.replace(e, function (t, r, e, o, a) {
        return (
          (i += n.slice(u, a).replace(D, L)),
          (u = a + t.length),
          r
            ? (i += "'+\n((__t=(" + r + "))==null?'':_.escape(__t))+\n'")
            : e
            ? (i += "'+\n((__t=(" + e + "))==null?'':__t)+\n'")
            : o && (i += "';\n" + o + "\n__p+='"),
          t
        );
      }),
        (i += "';\n"),
        t.variable || (i = "with(obj||{}){\n" + i + "}\n"),
        (i =
          "var __t,__p='',__j=Array.prototype.join," +
          "print=function(){__p+=__j.call(arguments,'');};\n" +
          i +
          "return __p;\n");
      try {
        var o = new Function(t.variable || "obj", "_", i);
      } catch (a) {
        throw ((a.source = i), a);
      }
      var c = function (n) {
          return o.call(this, n, m);
        },
        f = t.variable || "obj";
      return (c.source = "function(" + f + "){\n" + i + "}"), c;
    }),
      (m.chain = function (n) {
        var t = m(n);
        return (t._chain = !0), t;
      });
    var P = function (n, t) {
      return n._chain ? m(t).chain() : t;
    };
    (m.mixin = function (n) {
      m.each(m.functions(n), function (t) {
        var r = (m[t] = n[t]);
        m.prototype[t] = function () {
          var n = [this._wrapped];
          return f.apply(n, arguments), P(this, r.apply(m, n));
        };
      });
    }),
      m.mixin(m),
      m.each(
        ["pop", "push", "reverse", "shift", "sort", "splice", "unshift"],
        function (n) {
          var t = o[n];
          m.prototype[n] = function () {
            var r = this._wrapped;
            return (
              t.apply(r, arguments),
              ("shift" !== n && "splice" !== n) ||
                0 !== r.length ||
                delete r[0],
              P(this, r)
            );
          };
        }
      ),
      m.each(["concat", "join", "slice"], function (n) {
        var t = o[n];
        m.prototype[n] = function () {
          return P(this, t.apply(this._wrapped, arguments));
        };
      }),
      (m.prototype.value = function () {
        return this._wrapped;
      }),
      (m.prototype.valueOf = m.prototype.toJSON = m.prototype.value),
      (m.prototype.toString = function () {
        return "" + this._wrapped;
      }),
      "function" == typeof define &&
        define.amd &&
        define("underscore", [], function () {
          return m;
        });
  }).call(this);
  //# sourceMappingURL=underscore-min.map
  //! moment.js
  //! version : 2.8.3
  //! authors : Tim Wood, Iskren Chernev, Moment.js contributors
  //! license : MIT
  //! momentjs.com
  (function (a) {
    function b(a, b, c) {
      switch (arguments.length) {
        case 2:
          return null != a ? a : b;
        case 3:
          return null != a ? a : null != b ? b : c;
        default:
          throw new Error("Implement me");
      }
    }
    function c(a, b) {
      return zb.call(a, b);
    }
    function d() {
      return {
        empty: !1,
        unusedTokens: [],
        unusedInput: [],
        overflow: -2,
        charsLeftOver: 0,
        nullInput: !1,
        invalidMonth: null,
        invalidFormat: !1,
        userInvalidated: !1,
        iso: !1,
      };
    }
    function e(a) {
      tb.suppressDeprecationWarnings === !1 &&
        "undefined" != typeof console &&
        console.warn &&
        console.warn("Deprecation warning: " + a);
    }
    function f(a, b) {
      var c = !0;
      return m(function () {
        return c && (e(a), (c = !1)), b.apply(this, arguments);
      }, b);
    }
    function g(a, b) {
      qc[a] || (e(b), (qc[a] = !0));
    }
    function h(a, b) {
      return function (c) {
        return p(a.call(this, c), b);
      };
    }
    function i(a, b) {
      return function (c) {
        return this.localeData().ordinal(a.call(this, c), b);
      };
    }
    function j() {}
    function k(a, b) {
      b !== !1 && F(a), n(this, a), (this._d = new Date(+a._d));
    }
    function l(a) {
      var b = y(a),
        c = b.year || 0,
        d = b.quarter || 0,
        e = b.month || 0,
        f = b.week || 0,
        g = b.day || 0,
        h = b.hour || 0,
        i = b.minute || 0,
        j = b.second || 0,
        k = b.millisecond || 0;
      (this._milliseconds = +k + 1e3 * j + 6e4 * i + 36e5 * h),
        (this._days = +g + 7 * f),
        (this._months = +e + 3 * d + 12 * c),
        (this._data = {}),
        (this._locale = tb.localeData()),
        this._bubble();
    }
    function m(a, b) {
      for (var d in b) c(b, d) && (a[d] = b[d]);
      return (
        c(b, "toString") && (a.toString = b.toString),
        c(b, "valueOf") && (a.valueOf = b.valueOf),
        a
      );
    }
    function n(a, b) {
      var c, d, e;
      if (
        ("undefined" != typeof b._isAMomentObject &&
          (a._isAMomentObject = b._isAMomentObject),
        "undefined" != typeof b._i && (a._i = b._i),
        "undefined" != typeof b._f && (a._f = b._f),
        "undefined" != typeof b._l && (a._l = b._l),
        "undefined" != typeof b._strict && (a._strict = b._strict),
        "undefined" != typeof b._tzm && (a._tzm = b._tzm),
        "undefined" != typeof b._isUTC && (a._isUTC = b._isUTC),
        "undefined" != typeof b._offset && (a._offset = b._offset),
        "undefined" != typeof b._pf && (a._pf = b._pf),
        "undefined" != typeof b._locale && (a._locale = b._locale),
        Ib.length > 0)
      )
        for (c in Ib)
          (d = Ib[c]), (e = b[d]), "undefined" != typeof e && (a[d] = e);
      return a;
    }
    function o(a) {
      return 0 > a ? Math.ceil(a) : Math.floor(a);
    }
    function p(a, b, c) {
      for (var d = "" + Math.abs(a), e = a >= 0; d.length < b; ) d = "0" + d;
      return (e ? (c ? "+" : "") : "-") + d;
    }
    function q(a, b) {
      var c = { milliseconds: 0, months: 0 };
      return (
        (c.months = b.month() - a.month() + 12 * (b.year() - a.year())),
        a.clone().add(c.months, "M").isAfter(b) && --c.months,
        (c.milliseconds = +b - +a.clone().add(c.months, "M")),
        c
      );
    }
    function r(a, b) {
      var c;
      return (
        (b = K(b, a)),
        a.isBefore(b)
          ? (c = q(a, b))
          : ((c = q(b, a)),
            (c.milliseconds = -c.milliseconds),
            (c.months = -c.months)),
        c
      );
    }
    function s(a, b) {
      return function (c, d) {
        var e, f;
        return (
          null === d ||
            isNaN(+d) ||
            (g(
              b,
              "moment()." +
                b +
                "(period, number) is deprecated. Please use moment()." +
                b +
                "(number, period)."
            ),
            (f = c),
            (c = d),
            (d = f)),
          (c = "string" == typeof c ? +c : c),
          (e = tb.duration(c, d)),
          t(this, e, a),
          this
        );
      };
    }
    function t(a, b, c, d) {
      var e = b._milliseconds,
        f = b._days,
        g = b._months;
      (d = null == d ? !0 : d),
        e && a._d.setTime(+a._d + e * c),
        f && nb(a, "Date", mb(a, "Date") + f * c),
        g && lb(a, mb(a, "Month") + g * c),
        d && tb.updateOffset(a, f || g);
    }
    function u(a) {
      return "[object Array]" === Object.prototype.toString.call(a);
    }
    function v(a) {
      return (
        "[object Date]" === Object.prototype.toString.call(a) ||
        a instanceof Date
      );
    }
    function w(a, b, c) {
      var d,
        e = Math.min(a.length, b.length),
        f = Math.abs(a.length - b.length),
        g = 0;
      for (d = 0; e > d; d++)
        ((c && a[d] !== b[d]) || (!c && A(a[d]) !== A(b[d]))) && g++;
      return g + f;
    }
    function x(a) {
      if (a) {
        var b = a.toLowerCase().replace(/(.)s$/, "$1");
        a = jc[a] || kc[b] || b;
      }
      return a;
    }
    function y(a) {
      var b,
        d,
        e = {};
      for (d in a) c(a, d) && ((b = x(d)), b && (e[b] = a[d]));
      return e;
    }
    function z(b) {
      var c, d;
      if (0 === b.indexOf("week")) (c = 7), (d = "day");
      else {
        if (0 !== b.indexOf("month")) return;
        (c = 12), (d = "month");
      }
      tb[b] = function (e, f) {
        var g,
          h,
          i = tb._locale[b],
          j = [];
        if (
          ("number" == typeof e && ((f = e), (e = a)),
          (h = function (a) {
            var b = tb().utc().set(d, a);
            return i.call(tb._locale, b, e || "");
          }),
          null != f)
        )
          return h(f);
        for (g = 0; c > g; g++) j.push(h(g));
        return j;
      };
    }
    function A(a) {
      var b = +a,
        c = 0;
      return (
        0 !== b && isFinite(b) && (c = b >= 0 ? Math.floor(b) : Math.ceil(b)), c
      );
    }
    function B(a, b) {
      return new Date(Date.UTC(a, b + 1, 0)).getUTCDate();
    }
    function C(a, b, c) {
      return hb(tb([a, 11, 31 + b - c]), b, c).week;
    }
    function D(a) {
      return E(a) ? 366 : 365;
    }
    function E(a) {
      return (a % 4 === 0 && a % 100 !== 0) || a % 400 === 0;
    }
    function F(a) {
      var b;
      a._a &&
        -2 === a._pf.overflow &&
        ((b =
          a._a[Bb] < 0 || a._a[Bb] > 11
            ? Bb
            : a._a[Cb] < 1 || a._a[Cb] > B(a._a[Ab], a._a[Bb])
            ? Cb
            : a._a[Db] < 0 || a._a[Db] > 23
            ? Db
            : a._a[Eb] < 0 || a._a[Eb] > 59
            ? Eb
            : a._a[Fb] < 0 || a._a[Fb] > 59
            ? Fb
            : a._a[Gb] < 0 || a._a[Gb] > 999
            ? Gb
            : -1),
        a._pf._overflowDayOfYear && (Ab > b || b > Cb) && (b = Cb),
        (a._pf.overflow = b));
    }
    function G(a) {
      return (
        null == a._isValid &&
          ((a._isValid =
            !isNaN(a._d.getTime()) &&
            a._pf.overflow < 0 &&
            !a._pf.empty &&
            !a._pf.invalidMonth &&
            !a._pf.nullInput &&
            !a._pf.invalidFormat &&
            !a._pf.userInvalidated),
          a._strict &&
            (a._isValid =
              a._isValid &&
              0 === a._pf.charsLeftOver &&
              0 === a._pf.unusedTokens.length)),
        a._isValid
      );
    }
    function H(a) {
      return a ? a.toLowerCase().replace("_", "-") : a;
    }
    function I(a) {
      for (var b, c, d, e, f = 0; f < a.length; ) {
        for (
          e = H(a[f]).split("-"),
            b = e.length,
            c = H(a[f + 1]),
            c = c ? c.split("-") : null;
          b > 0;

        ) {
          if ((d = J(e.slice(0, b).join("-")))) return d;
          if (c && c.length >= b && w(e, c, !0) >= b - 1) break;
          b--;
        }
        f++;
      }
      return null;
    }
    function J(a) {
      var b = null;
      if (!Hb[a] && Jb)
        try {
          (b = tb.locale()), require("./locale/" + a), tb.locale(b);
        } catch (c) {}
      return Hb[a];
    }
    function K(a, b) {
      return b._isUTC ? tb(a).zone(b._offset || 0) : tb(a).local();
    }
    function L(a) {
      return a.match(/\[[\s\S]/)
        ? a.replace(/^\[|\]$/g, "")
        : a.replace(/\\/g, "");
    }
    function M(a) {
      var b,
        c,
        d = a.match(Nb);
      for (b = 0, c = d.length; c > b; b++)
        d[b] = pc[d[b]] ? pc[d[b]] : L(d[b]);
      return function (e) {
        var f = "";
        for (b = 0; c > b; b++)
          f += d[b] instanceof Function ? d[b].call(e, a) : d[b];
        return f;
      };
    }
    function N(a, b) {
      return a.isValid()
        ? ((b = O(b, a.localeData())), lc[b] || (lc[b] = M(b)), lc[b](a))
        : a.localeData().invalidDate();
    }
    function O(a, b) {
      function c(a) {
        return b.longDateFormat(a) || a;
      }
      var d = 5;
      for (Ob.lastIndex = 0; d >= 0 && Ob.test(a); )
        (a = a.replace(Ob, c)), (Ob.lastIndex = 0), (d -= 1);
      return a;
    }
    function P(a, b) {
      var c,
        d = b._strict;
      switch (a) {
        case "Q":
          return Zb;
        case "DDDD":
          return _b;
        case "YYYY":
        case "GGGG":
        case "gggg":
          return d ? ac : Rb;
        case "Y":
        case "G":
        case "g":
          return cc;
        case "YYYYYY":
        case "YYYYY":
        case "GGGGG":
        case "ggggg":
          return d ? bc : Sb;
        case "S":
          if (d) return Zb;
        case "SS":
          if (d) return $b;
        case "SSS":
          if (d) return _b;
        case "DDD":
          return Qb;
        case "MMM":
        case "MMMM":
        case "dd":
        case "ddd":
        case "dddd":
          return Ub;
        case "a":
        case "A":
          return b._locale._meridiemParse;
        case "X":
          return Xb;
        case "Z":
        case "ZZ":
          return Vb;
        case "T":
          return Wb;
        case "SSSS":
          return Tb;
        case "MM":
        case "DD":
        case "YY":
        case "GG":
        case "gg":
        case "HH":
        case "hh":
        case "mm":
        case "ss":
        case "ww":
        case "WW":
          return d ? $b : Pb;
        case "M":
        case "D":
        case "d":
        case "H":
        case "h":
        case "m":
        case "s":
        case "w":
        case "W":
        case "e":
        case "E":
          return Pb;
        case "Do":
          return Yb;
        default:
          return (c = new RegExp(Y(X(a.replace("\\", "")), "i")));
      }
    }
    function Q(a) {
      a = a || "";
      var b = a.match(Vb) || [],
        c = b[b.length - 1] || [],
        d = (c + "").match(hc) || ["-", 0, 0],
        e = +(60 * d[1]) + A(d[2]);
      return "+" === d[0] ? -e : e;
    }
    function R(a, b, c) {
      var d,
        e = c._a;
      switch (a) {
        case "Q":
          null != b && (e[Bb] = 3 * (A(b) - 1));
          break;
        case "M":
        case "MM":
          null != b && (e[Bb] = A(b) - 1);
          break;
        case "MMM":
        case "MMMM":
          (d = c._locale.monthsParse(b)),
            null != d ? (e[Bb] = d) : (c._pf.invalidMonth = b);
          break;
        case "D":
        case "DD":
          null != b && (e[Cb] = A(b));
          break;
        case "Do":
          null != b && (e[Cb] = A(parseInt(b, 10)));
          break;
        case "DDD":
        case "DDDD":
          null != b && (c._dayOfYear = A(b));
          break;
        case "YY":
          e[Ab] = tb.parseTwoDigitYear(b);
          break;
        case "YYYY":
        case "YYYYY":
        case "YYYYYY":
          e[Ab] = A(b);
          break;
        case "a":
        case "A":
          c._isPm = c._locale.isPM(b);
          break;
        case "H":
        case "HH":
        case "h":
        case "hh":
          e[Db] = A(b);
          break;
        case "m":
        case "mm":
          e[Eb] = A(b);
          break;
        case "s":
        case "ss":
          e[Fb] = A(b);
          break;
        case "S":
        case "SS":
        case "SSS":
        case "SSSS":
          e[Gb] = A(1e3 * ("0." + b));
          break;
        case "X":
          c._d = new Date(1e3 * parseFloat(b));
          break;
        case "Z":
        case "ZZ":
          (c._useUTC = !0), (c._tzm = Q(b));
          break;
        case "dd":
        case "ddd":
        case "dddd":
          (d = c._locale.weekdaysParse(b)),
            null != d
              ? ((c._w = c._w || {}), (c._w.d = d))
              : (c._pf.invalidWeekday = b);
          break;
        case "w":
        case "ww":
        case "W":
        case "WW":
        case "d":
        case "e":
        case "E":
          a = a.substr(0, 1);
        case "gggg":
        case "GGGG":
        case "GGGGG":
          (a = a.substr(0, 2)), b && ((c._w = c._w || {}), (c._w[a] = A(b)));
          break;
        case "gg":
        case "GG":
          (c._w = c._w || {}), (c._w[a] = tb.parseTwoDigitYear(b));
      }
    }
    function S(a) {
      var c, d, e, f, g, h, i;
      (c = a._w),
        null != c.GG || null != c.W || null != c.E
          ? ((g = 1),
            (h = 4),
            (d = b(c.GG, a._a[Ab], hb(tb(), 1, 4).year)),
            (e = b(c.W, 1)),
            (f = b(c.E, 1)))
          : ((g = a._locale._week.dow),
            (h = a._locale._week.doy),
            (d = b(c.gg, a._a[Ab], hb(tb(), g, h).year)),
            (e = b(c.w, 1)),
            null != c.d
              ? ((f = c.d), g > f && ++e)
              : (f = null != c.e ? c.e + g : g)),
        (i = ib(d, e, f, h, g)),
        (a._a[Ab] = i.year),
        (a._dayOfYear = i.dayOfYear);
    }
    function T(a) {
      var c,
        d,
        e,
        f,
        g = [];
      if (!a._d) {
        for (
          e = V(a),
            a._w && null == a._a[Cb] && null == a._a[Bb] && S(a),
            a._dayOfYear &&
              ((f = b(a._a[Ab], e[Ab])),
              a._dayOfYear > D(f) && (a._pf._overflowDayOfYear = !0),
              (d = db(f, 0, a._dayOfYear)),
              (a._a[Bb] = d.getUTCMonth()),
              (a._a[Cb] = d.getUTCDate())),
            c = 0;
          3 > c && null == a._a[c];
          ++c
        )
          a._a[c] = g[c] = e[c];
        for (; 7 > c; c++)
          a._a[c] = g[c] = null == a._a[c] ? (2 === c ? 1 : 0) : a._a[c];
        (a._d = (a._useUTC ? db : cb).apply(null, g)),
          null != a._tzm && a._d.setUTCMinutes(a._d.getUTCMinutes() + a._tzm);
      }
    }
    function U(a) {
      var b;
      a._d ||
        ((b = y(a._i)),
        (a._a = [
          b.year,
          b.month,
          b.day,
          b.hour,
          b.minute,
          b.second,
          b.millisecond,
        ]),
        T(a));
    }
    function V(a) {
      var b = new Date();
      return a._useUTC
        ? [b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate()]
        : [b.getFullYear(), b.getMonth(), b.getDate()];
    }
    function W(a) {
      if (a._f === tb.ISO_8601) return void $(a);
      (a._a = []), (a._pf.empty = !0);
      var b,
        c,
        d,
        e,
        f,
        g = "" + a._i,
        h = g.length,
        i = 0;
      for (d = O(a._f, a._locale).match(Nb) || [], b = 0; b < d.length; b++)
        (e = d[b]),
          (c = (g.match(P(e, a)) || [])[0]),
          c &&
            ((f = g.substr(0, g.indexOf(c))),
            f.length > 0 && a._pf.unusedInput.push(f),
            (g = g.slice(g.indexOf(c) + c.length)),
            (i += c.length)),
          pc[e]
            ? (c ? (a._pf.empty = !1) : a._pf.unusedTokens.push(e), R(e, c, a))
            : a._strict && !c && a._pf.unusedTokens.push(e);
      (a._pf.charsLeftOver = h - i),
        g.length > 0 && a._pf.unusedInput.push(g),
        a._isPm && a._a[Db] < 12 && (a._a[Db] += 12),
        a._isPm === !1 && 12 === a._a[Db] && (a._a[Db] = 0),
        T(a),
        F(a);
    }
    function X(a) {
      return a.replace(
        /\\(\[)|\\(\])|\[([^\]\[]*)\]|\\(.)/g,
        function (a, b, c, d, e) {
          return b || c || d || e;
        }
      );
    }
    function Y(a) {
      return a.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
    }
    function Z(a) {
      var b, c, e, f, g;
      if (0 === a._f.length)
        return (a._pf.invalidFormat = !0), void (a._d = new Date(0 / 0));
      for (f = 0; f < a._f.length; f++)
        (g = 0),
          (b = n({}, a)),
          null != a._useUTC && (b._useUTC = a._useUTC),
          (b._pf = d()),
          (b._f = a._f[f]),
          W(b),
          G(b) &&
            ((g += b._pf.charsLeftOver),
            (g += 10 * b._pf.unusedTokens.length),
            (b._pf.score = g),
            (null == e || e > g) && ((e = g), (c = b)));
      m(a, c || b);
    }
    function $(a) {
      var b,
        c,
        d = a._i,
        e = dc.exec(d);
      if (e) {
        for (a._pf.iso = !0, b = 0, c = fc.length; c > b; b++)
          if (fc[b][1].exec(d)) {
            a._f = fc[b][0] + (e[6] || " ");
            break;
          }
        for (b = 0, c = gc.length; c > b; b++)
          if (gc[b][1].exec(d)) {
            a._f += gc[b][0];
            break;
          }
        d.match(Vb) && (a._f += "Z"), W(a);
      } else a._isValid = !1;
    }
    function _(a) {
      $(a),
        a._isValid === !1 && (delete a._isValid, tb.createFromInputFallback(a));
    }
    function ab(a, b) {
      var c,
        d = [];
      for (c = 0; c < a.length; ++c) d.push(b(a[c], c));
      return d;
    }
    function bb(b) {
      var c,
        d = b._i;
      d === a
        ? (b._d = new Date())
        : v(d)
        ? (b._d = new Date(+d))
        : null !== (c = Kb.exec(d))
        ? (b._d = new Date(+c[1]))
        : "string" == typeof d
        ? _(b)
        : u(d)
        ? ((b._a = ab(d.slice(0), function (a) {
            return parseInt(a, 10);
          })),
          T(b))
        : "object" == typeof d
        ? U(b)
        : "number" == typeof d
        ? (b._d = new Date(d))
        : tb.createFromInputFallback(b);
    }
    function cb(a, b, c, d, e, f, g) {
      var h = new Date(a, b, c, d, e, f, g);
      return 1970 > a && h.setFullYear(a), h;
    }
    function db(a) {
      var b = new Date(Date.UTC.apply(null, arguments));
      return 1970 > a && b.setUTCFullYear(a), b;
    }
    function eb(a, b) {
      if ("string" == typeof a)
        if (isNaN(a)) {
          if (((a = b.weekdaysParse(a)), "number" != typeof a)) return null;
        } else a = parseInt(a, 10);
      return a;
    }
    function fb(a, b, c, d, e) {
      return e.relativeTime(b || 1, !!c, a, d);
    }
    function gb(a, b, c) {
      var d = tb.duration(a).abs(),
        e = yb(d.as("s")),
        f = yb(d.as("m")),
        g = yb(d.as("h")),
        h = yb(d.as("d")),
        i = yb(d.as("M")),
        j = yb(d.as("y")),
        k = (e < mc.s && ["s", e]) ||
          (1 === f && ["m"]) ||
          (f < mc.m && ["mm", f]) ||
          (1 === g && ["h"]) ||
          (g < mc.h && ["hh", g]) ||
          (1 === h && ["d"]) ||
          (h < mc.d && ["dd", h]) ||
          (1 === i && ["M"]) ||
          (i < mc.M && ["MM", i]) ||
          (1 === j && ["y"]) || ["yy", j];
      return (k[2] = b), (k[3] = +a > 0), (k[4] = c), fb.apply({}, k);
    }
    function hb(a, b, c) {
      var d,
        e = c - b,
        f = c - a.day();
      return (
        f > e && (f -= 7),
        e - 7 > f && (f += 7),
        (d = tb(a).add(f, "d")),
        { week: Math.ceil(d.dayOfYear() / 7), year: d.year() }
      );
    }
    function ib(a, b, c, d, e) {
      var f,
        g,
        h = db(a, 0, 1).getUTCDay();
      return (
        (h = 0 === h ? 7 : h),
        (c = null != c ? c : e),
        (f = e - h + (h > d ? 7 : 0) - (e > h ? 7 : 0)),
        (g = 7 * (b - 1) + (c - e) + f + 1),
        { year: g > 0 ? a : a - 1, dayOfYear: g > 0 ? g : D(a - 1) + g }
      );
    }
    function jb(b) {
      var c = b._i,
        d = b._f;
      return (
        (b._locale = b._locale || tb.localeData(b._l)),
        null === c || (d === a && "" === c)
          ? tb.invalid({ nullInput: !0 })
          : ("string" == typeof c && (b._i = c = b._locale.preparse(c)),
            tb.isMoment(c)
              ? new k(c, !0)
              : (d ? (u(d) ? Z(b) : W(b)) : bb(b), new k(b)))
      );
    }
    function kb(a, b) {
      var c, d;
      if ((1 === b.length && u(b[0]) && (b = b[0]), !b.length)) return tb();
      for (c = b[0], d = 1; d < b.length; ++d) b[d][a](c) && (c = b[d]);
      return c;
    }
    function lb(a, b) {
      var c;
      return "string" == typeof b &&
        ((b = a.localeData().monthsParse(b)), "number" != typeof b)
        ? a
        : ((c = Math.min(a.date(), B(a.year(), b))),
          a._d["set" + (a._isUTC ? "UTC" : "") + "Month"](b, c),
          a);
    }
    function mb(a, b) {
      return a._d["get" + (a._isUTC ? "UTC" : "") + b]();
    }
    function nb(a, b, c) {
      return "Month" === b
        ? lb(a, c)
        : a._d["set" + (a._isUTC ? "UTC" : "") + b](c);
    }
    function ob(a, b) {
      return function (c) {
        return null != c
          ? (nb(this, a, c), tb.updateOffset(this, b), this)
          : mb(this, a);
      };
    }
    function pb(a) {
      return (400 * a) / 146097;
    }
    function qb(a) {
      return (146097 * a) / 400;
    }
    function rb(a) {
      tb.duration.fn[a] = function () {
        return this._data[a];
      };
    }
    function sb(a) {
      "undefined" == typeof ender &&
        ((ub = xb.moment),
        (xb.moment = a
          ? f(
              "Accessing Moment through the global scope is deprecated, and will be removed in an upcoming release.",
              tb
            )
          : tb));
    }
    for (
      var tb,
        ub,
        vb,
        wb = "2.8.3",
        xb = "undefined" != typeof global ? global : this,
        yb = Math.round,
        zb = Object.prototype.hasOwnProperty,
        Ab = 0,
        Bb = 1,
        Cb = 2,
        Db = 3,
        Eb = 4,
        Fb = 5,
        Gb = 6,
        Hb = {},
        Ib = [],
        Jb = "undefined" != typeof module && module.exports,
        Kb = /^\/?Date\((\-?\d+)/i,
        Lb = /(\-)?(?:(\d*)\.)?(\d+)\:(\d+)(?:\:(\d+)\.?(\d{3})?)?/,
        Mb =
          /^(-)?P(?:(?:([0-9,.]*)Y)?(?:([0-9,.]*)M)?(?:([0-9,.]*)D)?(?:T(?:([0-9,.]*)H)?(?:([0-9,.]*)M)?(?:([0-9,.]*)S)?)?|([0-9,.]*)W)$/,
        Nb =
          /(\[[^\[]*\])|(\\)?(Mo|MM?M?M?|Do|DDDo|DD?D?D?|ddd?d?|do?|w[o|w]?|W[o|W]?|Q|YYYYYY|YYYYY|YYYY|YY|gg(ggg?)?|GG(GGG?)?|e|E|a|A|hh?|HH?|mm?|ss?|S{1,4}|X|zz?|ZZ?|.)/g,
        Ob = /(\[[^\[]*\])|(\\)?(LT|LL?L?L?|l{1,4})/g,
        Pb = /\d\d?/,
        Qb = /\d{1,3}/,
        Rb = /\d{1,4}/,
        Sb = /[+\-]?\d{1,6}/,
        Tb = /\d+/,
        Ub =
          /[0-9]*['a-z\u00A0-\u05FF\u0700-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]+|[\u0600-\u06FF\/]+(\s*?[\u0600-\u06FF]+){1,2}/i,
        Vb = /Z|[\+\-]\d\d:?\d\d/gi,
        Wb = /T/i,
        Xb = /[\+\-]?\d+(\.\d{1,3})?/,
        Yb = /\d{1,2}/,
        Zb = /\d/,
        $b = /\d\d/,
        _b = /\d{3}/,
        ac = /\d{4}/,
        bc = /[+-]?\d{6}/,
        cc = /[+-]?\d+/,
        dc =
          /^\s*(?:[+-]\d{6}|\d{4})-(?:(\d\d-\d\d)|(W\d\d$)|(W\d\d-\d)|(\d\d\d))((T| )(\d\d(:\d\d(:\d\d(\.\d+)?)?)?)?([\+\-]\d\d(?::?\d\d)?|\s*Z)?)?$/,
        ec = "YYYY-MM-DDTHH:mm:ssZ",
        fc = [
          ["YYYYYY-MM-DD", /[+-]\d{6}-\d{2}-\d{2}/],
          ["YYYY-MM-DD", /\d{4}-\d{2}-\d{2}/],
          ["GGGG-[W]WW-E", /\d{4}-W\d{2}-\d/],
          ["GGGG-[W]WW", /\d{4}-W\d{2}/],
          ["YYYY-DDD", /\d{4}-\d{3}/],
        ],
        gc = [
          ["HH:mm:ss.SSSS", /(T| )\d\d:\d\d:\d\d\.\d+/],
          ["HH:mm:ss", /(T| )\d\d:\d\d:\d\d/],
          ["HH:mm", /(T| )\d\d:\d\d/],
          ["HH", /(T| )\d\d/],
        ],
        hc = /([\+\-]|\d\d)/gi,
        ic =
          ("Date|Hours|Minutes|Seconds|Milliseconds".split("|"),
          {
            Milliseconds: 1,
            Seconds: 1e3,
            Minutes: 6e4,
            Hours: 36e5,
            Days: 864e5,
            Months: 2592e6,
            Years: 31536e6,
          }),
        jc = {
          ms: "millisecond",
          s: "second",
          m: "minute",
          h: "hour",
          d: "day",
          D: "date",
          w: "week",
          W: "isoWeek",
          M: "month",
          Q: "quarter",
          y: "year",
          DDD: "dayOfYear",
          e: "weekday",
          E: "isoWeekday",
          gg: "weekYear",
          GG: "isoWeekYear",
        },
        kc = {
          dayofyear: "dayOfYear",
          isoweekday: "isoWeekday",
          isoweek: "isoWeek",
          weekyear: "weekYear",
          isoweekyear: "isoWeekYear",
        },
        lc = {},
        mc = { s: 45, m: 45, h: 22, d: 26, M: 11 },
        nc = "DDD w W M D d".split(" "),
        oc = "M D H h m s w W".split(" "),
        pc = {
          M: function () {
            return this.month() + 1;
          },
          MMM: function (a) {
            return this.localeData().monthsShort(this, a);
          },
          MMMM: function (a) {
            return this.localeData().months(this, a);
          },
          D: function () {
            return this.date();
          },
          DDD: function () {
            return this.dayOfYear();
          },
          d: function () {
            return this.day();
          },
          dd: function (a) {
            return this.localeData().weekdaysMin(this, a);
          },
          ddd: function (a) {
            return this.localeData().weekdaysShort(this, a);
          },
          dddd: function (a) {
            return this.localeData().weekdays(this, a);
          },
          w: function () {
            return this.week();
          },
          W: function () {
            return this.isoWeek();
          },
          YY: function () {
            return p(this.year() % 100, 2);
          },
          YYYY: function () {
            return p(this.year(), 4);
          },
          YYYYY: function () {
            return p(this.year(), 5);
          },
          YYYYYY: function () {
            var a = this.year(),
              b = a >= 0 ? "+" : "-";
            return b + p(Math.abs(a), 6);
          },
          gg: function () {
            return p(this.weekYear() % 100, 2);
          },
          gggg: function () {
            return p(this.weekYear(), 4);
          },
          ggggg: function () {
            return p(this.weekYear(), 5);
          },
          GG: function () {
            return p(this.isoWeekYear() % 100, 2);
          },
          GGGG: function () {
            return p(this.isoWeekYear(), 4);
          },
          GGGGG: function () {
            return p(this.isoWeekYear(), 5);
          },
          e: function () {
            return this.weekday();
          },
          E: function () {
            return this.isoWeekday();
          },
          a: function () {
            return this.localeData().meridiem(this.hours(), this.minutes(), !0);
          },
          A: function () {
            return this.localeData().meridiem(this.hours(), this.minutes(), !1);
          },
          H: function () {
            return this.hours();
          },
          h: function () {
            return this.hours() % 12 || 12;
          },
          m: function () {
            return this.minutes();
          },
          s: function () {
            return this.seconds();
          },
          S: function () {
            return A(this.milliseconds() / 100);
          },
          SS: function () {
            return p(A(this.milliseconds() / 10), 2);
          },
          SSS: function () {
            return p(this.milliseconds(), 3);
          },
          SSSS: function () {
            return p(this.milliseconds(), 3);
          },
          Z: function () {
            var a = -this.zone(),
              b = "+";
            return (
              0 > a && ((a = -a), (b = "-")),
              b + p(A(a / 60), 2) + ":" + p(A(a) % 60, 2)
            );
          },
          ZZ: function () {
            var a = -this.zone(),
              b = "+";
            return (
              0 > a && ((a = -a), (b = "-")),
              b + p(A(a / 60), 2) + p(A(a) % 60, 2)
            );
          },
          z: function () {
            return this.zoneAbbr();
          },
          zz: function () {
            return this.zoneName();
          },
          X: function () {
            return this.unix();
          },
          Q: function () {
            return this.quarter();
          },
        },
        qc = {},
        rc = [
          "months",
          "monthsShort",
          "weekdays",
          "weekdaysShort",
          "weekdaysMin",
        ];
      nc.length;

    )
      (vb = nc.pop()), (pc[vb + "o"] = i(pc[vb], vb));
    for (; oc.length; ) (vb = oc.pop()), (pc[vb + vb] = h(pc[vb], 2));
    (pc.DDDD = h(pc.DDD, 3)),
      m(j.prototype, {
        set: function (a) {
          var b, c;
          for (c in a)
            (b = a[c]),
              "function" == typeof b ? (this[c] = b) : (this["_" + c] = b);
        },
        _months:
          "January_February_March_April_May_June_July_August_September_October_November_December".split(
            "_"
          ),
        months: function (a) {
          return this._months[a.month()];
        },
        _monthsShort: "Jan_Feb_Mar_Apr_May_Jun_Jul_Aug_Sep_Oct_Nov_Dec".split(
          "_"
        ),
        monthsShort: function (a) {
          return this._monthsShort[a.month()];
        },
        monthsParse: function (a) {
          var b, c, d;
          for (
            this._monthsParse || (this._monthsParse = []), b = 0;
            12 > b;
            b++
          )
            if (
              (this._monthsParse[b] ||
                ((c = tb.utc([2e3, b])),
                (d = "^" + this.months(c, "") + "|^" + this.monthsShort(c, "")),
                (this._monthsParse[b] = new RegExp(d.replace(".", ""), "i"))),
              this._monthsParse[b].test(a))
            )
              return b;
        },
        _weekdays:
          "Sunday_Monday_Tuesday_Wednesday_Thursday_Friday_Saturday".split("_"),
        weekdays: function (a) {
          return this._weekdays[a.day()];
        },
        _weekdaysShort: "Sun_Mon_Tue_Wed_Thu_Fri_Sat".split("_"),
        weekdaysShort: function (a) {
          return this._weekdaysShort[a.day()];
        },
        _weekdaysMin: "Su_Mo_Tu_We_Th_Fr_Sa".split("_"),
        weekdaysMin: function (a) {
          return this._weekdaysMin[a.day()];
        },
        weekdaysParse: function (a) {
          var b, c, d;
          for (
            this._weekdaysParse || (this._weekdaysParse = []), b = 0;
            7 > b;
            b++
          )
            if (
              (this._weekdaysParse[b] ||
                ((c = tb([2e3, 1]).day(b)),
                (d =
                  "^" +
                  this.weekdays(c, "") +
                  "|^" +
                  this.weekdaysShort(c, "") +
                  "|^" +
                  this.weekdaysMin(c, "")),
                (this._weekdaysParse[b] = new RegExp(d.replace(".", ""), "i"))),
              this._weekdaysParse[b].test(a))
            )
              return b;
        },
        _longDateFormat: {
          LT: "h:mm A",
          L: "MM/DD/YYYY",
          LL: "MMMM D, YYYY",
          LLL: "MMMM D, YYYY LT",
          LLLL: "dddd, MMMM D, YYYY LT",
        },
        longDateFormat: function (a) {
          var b = this._longDateFormat[a];
          return (
            !b &&
              this._longDateFormat[a.toUpperCase()] &&
              ((b = this._longDateFormat[a.toUpperCase()].replace(
                /MMMM|MM|DD|dddd/g,
                function (a) {
                  return a.slice(1);
                }
              )),
              (this._longDateFormat[a] = b)),
            b
          );
        },
        isPM: function (a) {
          return "p" === (a + "").toLowerCase().charAt(0);
        },
        _meridiemParse: /[ap]\.?m?\.?/i,
        meridiem: function (a, b, c) {
          return a > 11 ? (c ? "pm" : "PM") : c ? "am" : "AM";
        },
        _calendar: {
          sameDay: "[Today at] LT",
          nextDay: "[Tomorrow at] LT",
          nextWeek: "dddd [at] LT",
          lastDay: "[Yesterday at] LT",
          lastWeek: "[Last] dddd [at] LT",
          sameElse: "L",
        },
        calendar: function (a, b) {
          var c = this._calendar[a];
          return "function" == typeof c ? c.apply(b) : c;
        },
        _relativeTime: {
          future: "in %s",
          past: "%s ago",
          s: "a few seconds",
          m: "a minute",
          mm: "%d minutes",
          h: "an hour",
          hh: "%d hours",
          d: "a day",
          dd: "%d days",
          M: "a month",
          MM: "%d months",
          y: "a year",
          yy: "%d years",
        },
        relativeTime: function (a, b, c, d) {
          var e = this._relativeTime[c];
          return "function" == typeof e ? e(a, b, c, d) : e.replace(/%d/i, a);
        },
        pastFuture: function (a, b) {
          var c = this._relativeTime[a > 0 ? "future" : "past"];
          return "function" == typeof c ? c(b) : c.replace(/%s/i, b);
        },
        ordinal: function (a) {
          return this._ordinal.replace("%d", a);
        },
        _ordinal: "%d",
        preparse: function (a) {
          return a;
        },
        postformat: function (a) {
          return a;
        },
        week: function (a) {
          return hb(a, this._week.dow, this._week.doy).week;
        },
        _week: { dow: 0, doy: 6 },
        _invalidDate: "Invalid date",
        invalidDate: function () {
          return this._invalidDate;
        },
      }),
      (tb = function (b, c, e, f) {
        var g;
        return (
          "boolean" == typeof e && ((f = e), (e = a)),
          (g = {}),
          (g._isAMomentObject = !0),
          (g._i = b),
          (g._f = c),
          (g._l = e),
          (g._strict = f),
          (g._isUTC = !1),
          (g._pf = d()),
          jb(g)
        );
      }),
      (tb.suppressDeprecationWarnings = !1),
      (tb.createFromInputFallback = f(
        "moment construction falls back to js Date. This is discouraged and will be removed in upcoming major release. Please refer to https://github.com/moment/moment/issues/1407 for more info.",
        function (a) {
          a._d = new Date(a._i);
        }
      )),
      (tb.min = function () {
        var a = [].slice.call(arguments, 0);
        return kb("isBefore", a);
      }),
      (tb.max = function () {
        var a = [].slice.call(arguments, 0);
        return kb("isAfter", a);
      }),
      (tb.utc = function (b, c, e, f) {
        var g;
        return (
          "boolean" == typeof e && ((f = e), (e = a)),
          (g = {}),
          (g._isAMomentObject = !0),
          (g._useUTC = !0),
          (g._isUTC = !0),
          (g._l = e),
          (g._i = b),
          (g._f = c),
          (g._strict = f),
          (g._pf = d()),
          jb(g).utc()
        );
      }),
      (tb.unix = function (a) {
        return tb(1e3 * a);
      }),
      (tb.duration = function (a, b) {
        var d,
          e,
          f,
          g,
          h = a,
          i = null;
        return (
          tb.isDuration(a)
            ? (h = { ms: a._milliseconds, d: a._days, M: a._months })
            : "number" == typeof a
            ? ((h = {}), b ? (h[b] = a) : (h.milliseconds = a))
            : (i = Lb.exec(a))
            ? ((d = "-" === i[1] ? -1 : 1),
              (h = {
                y: 0,
                d: A(i[Cb]) * d,
                h: A(i[Db]) * d,
                m: A(i[Eb]) * d,
                s: A(i[Fb]) * d,
                ms: A(i[Gb]) * d,
              }))
            : (i = Mb.exec(a))
            ? ((d = "-" === i[1] ? -1 : 1),
              (f = function (a) {
                var b = a && parseFloat(a.replace(",", "."));
                return (isNaN(b) ? 0 : b) * d;
              }),
              (h = {
                y: f(i[2]),
                M: f(i[3]),
                d: f(i[4]),
                h: f(i[5]),
                m: f(i[6]),
                s: f(i[7]),
                w: f(i[8]),
              }))
            : "object" == typeof h &&
              ("from" in h || "to" in h) &&
              ((g = r(tb(h.from), tb(h.to))),
              (h = {}),
              (h.ms = g.milliseconds),
              (h.M = g.months)),
          (e = new l(h)),
          tb.isDuration(a) && c(a, "_locale") && (e._locale = a._locale),
          e
        );
      }),
      (tb.version = wb),
      (tb.defaultFormat = ec),
      (tb.ISO_8601 = function () {}),
      (tb.momentProperties = Ib),
      (tb.updateOffset = function () {}),
      (tb.relativeTimeThreshold = function (b, c) {
        return mc[b] === a ? !1 : c === a ? mc[b] : ((mc[b] = c), !0);
      }),
      (tb.lang = f(
        "moment.lang is deprecated. Use moment.locale instead.",
        function (a, b) {
          return tb.locale(a, b);
        }
      )),
      (tb.locale = function (a, b) {
        var c;
        return (
          a &&
            ((c =
              "undefined" != typeof b
                ? tb.defineLocale(a, b)
                : tb.localeData(a)),
            c && (tb.duration._locale = tb._locale = c)),
          tb._locale._abbr
        );
      }),
      (tb.defineLocale = function (a, b) {
        return null !== b
          ? ((b.abbr = a),
            Hb[a] || (Hb[a] = new j()),
            Hb[a].set(b),
            tb.locale(a),
            Hb[a])
          : (delete Hb[a], null);
      }),
      (tb.langData = f(
        "moment.langData is deprecated. Use moment.localeData instead.",
        function (a) {
          return tb.localeData(a);
        }
      )),
      (tb.localeData = function (a) {
        var b;
        if ((a && a._locale && a._locale._abbr && (a = a._locale._abbr), !a))
          return tb._locale;
        if (!u(a)) {
          if ((b = J(a))) return b;
          a = [a];
        }
        return I(a);
      }),
      (tb.isMoment = function (a) {
        return a instanceof k || (null != a && c(a, "_isAMomentObject"));
      }),
      (tb.isDuration = function (a) {
        return a instanceof l;
      });
    for (vb = rc.length - 1; vb >= 0; --vb) z(rc[vb]);
    (tb.normalizeUnits = function (a) {
      return x(a);
    }),
      (tb.invalid = function (a) {
        var b = tb.utc(0 / 0);
        return null != a ? m(b._pf, a) : (b._pf.userInvalidated = !0), b;
      }),
      (tb.parseZone = function () {
        return tb.apply(null, arguments).parseZone();
      }),
      (tb.parseTwoDigitYear = function (a) {
        return A(a) + (A(a) > 68 ? 1900 : 2e3);
      }),
      m((tb.fn = k.prototype), {
        clone: function () {
          return tb(this);
        },
        valueOf: function () {
          return +this._d + 6e4 * (this._offset || 0);
        },
        unix: function () {
          return Math.floor(+this / 1e3);
        },
        toString: function () {
          return this.clone()
            .locale("en")
            .format("ddd MMM DD YYYY HH:mm:ss [GMT]ZZ");
        },
        toDate: function () {
          return this._offset ? new Date(+this) : this._d;
        },
        toISOString: function () {
          var a = tb(this).utc();
          return 0 < a.year() && a.year() <= 9999
            ? N(a, "YYYY-MM-DD[T]HH:mm:ss.SSS[Z]")
            : N(a, "YYYYYY-MM-DD[T]HH:mm:ss.SSS[Z]");
        },
        toArray: function () {
          var a = this;
          return [
            a.year(),
            a.month(),
            a.date(),
            a.hours(),
            a.minutes(),
            a.seconds(),
            a.milliseconds(),
          ];
        },
        isValid: function () {
          return G(this);
        },
        isDSTShifted: function () {
          return this._a
            ? this.isValid() &&
                w(
                  this._a,
                  (this._isUTC ? tb.utc(this._a) : tb(this._a)).toArray()
                ) > 0
            : !1;
        },
        parsingFlags: function () {
          return m({}, this._pf);
        },
        invalidAt: function () {
          return this._pf.overflow;
        },
        utc: function (a) {
          return this.zone(0, a);
        },
        local: function (a) {
          return (
            this._isUTC &&
              (this.zone(0, a),
              (this._isUTC = !1),
              a && this.add(this._dateTzOffset(), "m")),
            this
          );
        },
        format: function (a) {
          var b = N(this, a || tb.defaultFormat);
          return this.localeData().postformat(b);
        },
        add: s(1, "add"),
        subtract: s(-1, "subtract"),
        diff: function (a, b, c) {
          var d,
            e,
            f,
            g = K(a, this),
            h = 6e4 * (this.zone() - g.zone());
          return (
            (b = x(b)),
            "year" === b || "month" === b
              ? ((d = 432e5 * (this.daysInMonth() + g.daysInMonth())),
                (e =
                  12 * (this.year() - g.year()) + (this.month() - g.month())),
                (f =
                  this -
                  tb(this).startOf("month") -
                  (g - tb(g).startOf("month"))),
                (f -=
                  6e4 *
                  (this.zone() -
                    tb(this).startOf("month").zone() -
                    (g.zone() - tb(g).startOf("month").zone()))),
                (e += f / d),
                "year" === b && (e /= 12))
              : ((d = this - g),
                (e =
                  "second" === b
                    ? d / 1e3
                    : "minute" === b
                    ? d / 6e4
                    : "hour" === b
                    ? d / 36e5
                    : "day" === b
                    ? (d - h) / 864e5
                    : "week" === b
                    ? (d - h) / 6048e5
                    : d)),
            c ? e : o(e)
          );
        },
        from: function (a, b) {
          return tb
            .duration({ to: this, from: a })
            .locale(this.locale())
            .humanize(!b);
        },
        fromNow: function (a) {
          return this.from(tb(), a);
        },
        calendar: function (a) {
          var b = a || tb(),
            c = K(b, this).startOf("day"),
            d = this.diff(c, "days", !0),
            e =
              -6 > d
                ? "sameElse"
                : -1 > d
                ? "lastWeek"
                : 0 > d
                ? "lastDay"
                : 1 > d
                ? "sameDay"
                : 2 > d
                ? "nextDay"
                : 7 > d
                ? "nextWeek"
                : "sameElse";
          return this.format(this.localeData().calendar(e, this));
        },
        isLeapYear: function () {
          return E(this.year());
        },
        isDST: function () {
          return (
            this.zone() < this.clone().month(0).zone() ||
            this.zone() < this.clone().month(5).zone()
          );
        },
        day: function (a) {
          var b = this._isUTC ? this._d.getUTCDay() : this._d.getDay();
          return null != a
            ? ((a = eb(a, this.localeData())), this.add(a - b, "d"))
            : b;
        },
        month: ob("Month", !0),
        startOf: function (a) {
          switch ((a = x(a))) {
            case "year":
              this.month(0);
            case "quarter":
            case "month":
              this.date(1);
            case "week":
            case "isoWeek":
            case "day":
              this.hours(0);
            case "hour":
              this.minutes(0);
            case "minute":
              this.seconds(0);
            case "second":
              this.milliseconds(0);
          }
          return (
            "week" === a
              ? this.weekday(0)
              : "isoWeek" === a && this.isoWeekday(1),
            "quarter" === a && this.month(3 * Math.floor(this.month() / 3)),
            this
          );
        },
        endOf: function (a) {
          return (
            (a = x(a)),
            this.startOf(a)
              .add(1, "isoWeek" === a ? "week" : a)
              .subtract(1, "ms")
          );
        },
        isAfter: function (a, b) {
          return (
            (b = x("undefined" != typeof b ? b : "millisecond")),
            "millisecond" === b
              ? ((a = tb.isMoment(a) ? a : tb(a)), +this > +a)
              : +this.clone().startOf(b) > +tb(a).startOf(b)
          );
        },
        isBefore: function (a, b) {
          return (
            (b = x("undefined" != typeof b ? b : "millisecond")),
            "millisecond" === b
              ? ((a = tb.isMoment(a) ? a : tb(a)), +a > +this)
              : +this.clone().startOf(b) < +tb(a).startOf(b)
          );
        },
        isSame: function (a, b) {
          return (
            (b = x(b || "millisecond")),
            "millisecond" === b
              ? ((a = tb.isMoment(a) ? a : tb(a)), +this === +a)
              : +this.clone().startOf(b) === +K(a, this).startOf(b)
          );
        },
        min: f(
          "moment().min is deprecated, use moment.min instead. https://github.com/moment/moment/issues/1548",
          function (a) {
            return (a = tb.apply(null, arguments)), this > a ? this : a;
          }
        ),
        max: f(
          "moment().max is deprecated, use moment.max instead. https://github.com/moment/moment/issues/1548",
          function (a) {
            return (a = tb.apply(null, arguments)), a > this ? this : a;
          }
        ),
        zone: function (a, b) {
          var c,
            d = this._offset || 0;
          return null == a
            ? this._isUTC
              ? d
              : this._dateTzOffset()
            : ("string" == typeof a && (a = Q(a)),
              Math.abs(a) < 16 && (a = 60 * a),
              !this._isUTC && b && (c = this._dateTzOffset()),
              (this._offset = a),
              (this._isUTC = !0),
              null != c && this.subtract(c, "m"),
              d !== a &&
                (!b || this._changeInProgress
                  ? t(this, tb.duration(d - a, "m"), 1, !1)
                  : this._changeInProgress ||
                    ((this._changeInProgress = !0),
                    tb.updateOffset(this, !0),
                    (this._changeInProgress = null))),
              this);
        },
        zoneAbbr: function () {
          return this._isUTC ? "UTC" : "";
        },
        zoneName: function () {
          return this._isUTC ? "Coordinated Universal Time" : "";
        },
        parseZone: function () {
          return (
            this._tzm
              ? this.zone(this._tzm)
              : "string" == typeof this._i && this.zone(this._i),
            this
          );
        },
        hasAlignedHourOffset: function (a) {
          return (a = a ? tb(a).zone() : 0), (this.zone() - a) % 60 === 0;
        },
        daysInMonth: function () {
          return B(this.year(), this.month());
        },
        dayOfYear: function (a) {
          var b =
            yb((tb(this).startOf("day") - tb(this).startOf("year")) / 864e5) +
            1;
          return null == a ? b : this.add(a - b, "d");
        },
        quarter: function (a) {
          return null == a
            ? Math.ceil((this.month() + 1) / 3)
            : this.month(3 * (a - 1) + (this.month() % 3));
        },
        weekYear: function (a) {
          var b = hb(
            this,
            this.localeData()._week.dow,
            this.localeData()._week.doy
          ).year;
          return null == a ? b : this.add(a - b, "y");
        },
        isoWeekYear: function (a) {
          var b = hb(this, 1, 4).year;
          return null == a ? b : this.add(a - b, "y");
        },
        week: function (a) {
          var b = this.localeData().week(this);
          return null == a ? b : this.add(7 * (a - b), "d");
        },
        isoWeek: function (a) {
          var b = hb(this, 1, 4).week;
          return null == a ? b : this.add(7 * (a - b), "d");
        },
        weekday: function (a) {
          var b = (this.day() + 7 - this.localeData()._week.dow) % 7;
          return null == a ? b : this.add(a - b, "d");
        },
        isoWeekday: function (a) {
          return null == a
            ? this.day() || 7
            : this.day(this.day() % 7 ? a : a - 7);
        },
        isoWeeksInYear: function () {
          return C(this.year(), 1, 4);
        },
        weeksInYear: function () {
          var a = this.localeData()._week;
          return C(this.year(), a.dow, a.doy);
        },
        get: function (a) {
          return (a = x(a)), this[a]();
        },
        set: function (a, b) {
          return (a = x(a)), "function" == typeof this[a] && this[a](b), this;
        },
        locale: function (b) {
          var c;
          return b === a
            ? this._locale._abbr
            : ((c = tb.localeData(b)), null != c && (this._locale = c), this);
        },
        lang: f(
          "moment().lang() is deprecated. Use moment().localeData() instead.",
          function (b) {
            return b === a ? this.localeData() : this.locale(b);
          }
        ),
        localeData: function () {
          return this._locale;
        },
        _dateTzOffset: function () {
          return 15 * Math.round(this._d.getTimezoneOffset() / 15);
        },
      }),
      (tb.fn.millisecond = tb.fn.milliseconds = ob("Milliseconds", !1)),
      (tb.fn.second = tb.fn.seconds = ob("Seconds", !1)),
      (tb.fn.minute = tb.fn.minutes = ob("Minutes", !1)),
      (tb.fn.hour = tb.fn.hours = ob("Hours", !0)),
      (tb.fn.date = ob("Date", !0)),
      (tb.fn.dates = f(
        "dates accessor is deprecated. Use date instead.",
        ob("Date", !0)
      )),
      (tb.fn.year = ob("FullYear", !0)),
      (tb.fn.years = f(
        "years accessor is deprecated. Use year instead.",
        ob("FullYear", !0)
      )),
      (tb.fn.days = tb.fn.day),
      (tb.fn.months = tb.fn.month),
      (tb.fn.weeks = tb.fn.week),
      (tb.fn.isoWeeks = tb.fn.isoWeek),
      (tb.fn.quarters = tb.fn.quarter),
      (tb.fn.toJSON = tb.fn.toISOString),
      m((tb.duration.fn = l.prototype), {
        _bubble: function () {
          var a,
            b,
            c,
            d = this._milliseconds,
            e = this._days,
            f = this._months,
            g = this._data,
            h = 0;
          (g.milliseconds = d % 1e3),
            (a = o(d / 1e3)),
            (g.seconds = a % 60),
            (b = o(a / 60)),
            (g.minutes = b % 60),
            (c = o(b / 60)),
            (g.hours = c % 24),
            (e += o(c / 24)),
            (h = o(pb(e))),
            (e -= o(qb(h))),
            (f += o(e / 30)),
            (e %= 30),
            (h += o(f / 12)),
            (f %= 12),
            (g.days = e),
            (g.months = f),
            (g.years = h);
        },
        abs: function () {
          return (
            (this._milliseconds = Math.abs(this._milliseconds)),
            (this._days = Math.abs(this._days)),
            (this._months = Math.abs(this._months)),
            (this._data.milliseconds = Math.abs(this._data.milliseconds)),
            (this._data.seconds = Math.abs(this._data.seconds)),
            (this._data.minutes = Math.abs(this._data.minutes)),
            (this._data.hours = Math.abs(this._data.hours)),
            (this._data.months = Math.abs(this._data.months)),
            (this._data.years = Math.abs(this._data.years)),
            this
          );
        },
        weeks: function () {
          return o(this.days() / 7);
        },
        valueOf: function () {
          return (
            this._milliseconds +
            864e5 * this._days +
            (this._months % 12) * 2592e6 +
            31536e6 * A(this._months / 12)
          );
        },
        humanize: function (a) {
          var b = gb(this, !a, this.localeData());
          return (
            a && (b = this.localeData().pastFuture(+this, b)),
            this.localeData().postformat(b)
          );
        },
        add: function (a, b) {
          var c = tb.duration(a, b);
          return (
            (this._milliseconds += c._milliseconds),
            (this._days += c._days),
            (this._months += c._months),
            this._bubble(),
            this
          );
        },
        subtract: function (a, b) {
          var c = tb.duration(a, b);
          return (
            (this._milliseconds -= c._milliseconds),
            (this._days -= c._days),
            (this._months -= c._months),
            this._bubble(),
            this
          );
        },
        get: function (a) {
          return (a = x(a)), this[a.toLowerCase() + "s"]();
        },
        as: function (a) {
          var b, c;
          if (((a = x(a)), "month" === a || "year" === a))
            return (
              (b = this._days + this._milliseconds / 864e5),
              (c = this._months + 12 * pb(b)),
              "month" === a ? c : c / 12
            );
          switch (((b = this._days + qb(this._months / 12)), a)) {
            case "week":
              return b / 7 + this._milliseconds / 6048e5;
            case "day":
              return b + this._milliseconds / 864e5;
            case "hour":
              return 24 * b + this._milliseconds / 36e5;
            case "minute":
              return 24 * b * 60 + this._milliseconds / 6e4;
            case "second":
              return 24 * b * 60 * 60 + this._milliseconds / 1e3;
            case "millisecond":
              return Math.floor(24 * b * 60 * 60 * 1e3) + this._milliseconds;
            default:
              throw new Error("Unknown unit " + a);
          }
        },
        lang: tb.fn.lang,
        locale: tb.fn.locale,
        toIsoString: f(
          "toIsoString() is deprecated. Please use toISOString() instead (notice the capitals)",
          function () {
            return this.toISOString();
          }
        ),
        toISOString: function () {
          var a = Math.abs(this.years()),
            b = Math.abs(this.months()),
            c = Math.abs(this.days()),
            d = Math.abs(this.hours()),
            e = Math.abs(this.minutes()),
            f = Math.abs(this.seconds() + this.milliseconds() / 1e3);
          return this.asSeconds()
            ? (this.asSeconds() < 0 ? "-" : "") +
                "P" +
                (a ? a + "Y" : "") +
                (b ? b + "M" : "") +
                (c ? c + "D" : "") +
                (d || e || f ? "T" : "") +
                (d ? d + "H" : "") +
                (e ? e + "M" : "") +
                (f ? f + "S" : "")
            : "P0D";
        },
        localeData: function () {
          return this._locale;
        },
      }),
      (tb.duration.fn.toString = tb.duration.fn.toISOString);
    for (vb in ic) c(ic, vb) && rb(vb.toLowerCase());
    (tb.duration.fn.asMilliseconds = function () {
      return this.as("ms");
    }),
      (tb.duration.fn.asSeconds = function () {
        return this.as("s");
      }),
      (tb.duration.fn.asMinutes = function () {
        return this.as("m");
      }),
      (tb.duration.fn.asHours = function () {
        return this.as("h");
      }),
      (tb.duration.fn.asDays = function () {
        return this.as("d");
      }),
      (tb.duration.fn.asWeeks = function () {
        return this.as("weeks");
      }),
      (tb.duration.fn.asMonths = function () {
        return this.as("M");
      }),
      (tb.duration.fn.asYears = function () {
        return this.as("y");
      }),
      tb.locale("en", {
        ordinal: function (a) {
          var b = a % 10,
            c =
              1 === A((a % 100) / 10)
                ? "th"
                : 1 === b
                ? "st"
                : 2 === b
                ? "nd"
                : 3 === b
                ? "rd"
                : "th";
          return a + c;
        },
      }),
      (function (a) {
        a(tb);
      })(function (a) {
        return a.defineLocale("af", {
          months:
            "Januarie_Februarie_Maart_April_Mei_Junie_Julie_Augustus_September_Oktober_November_Desember".split(
              "_"
            ),
          monthsShort: "Jan_Feb_Mar_Apr_Mei_Jun_Jul_Aug_Sep_Okt_Nov_Des".split(
            "_"
          ),
          weekdays:
            "Sondag_Maandag_Dinsdag_Woensdag_Donderdag_Vrydag_Saterdag".split(
              "_"
            ),
          weekdaysShort: "Son_Maa_Din_Woe_Don_Vry_Sat".split("_"),
          weekdaysMin: "So_Ma_Di_Wo_Do_Vr_Sa".split("_"),
          meridiem: function (a, b, c) {
            return 12 > a ? (c ? "vm" : "VM") : c ? "nm" : "NM";
          },
          longDateFormat: {
            LT: "HH:mm",
            L: "DD/MM/YYYY",
            LL: "D MMMM YYYY",
            LLL: "D MMMM YYYY LT",
            LLLL: "dddd, D MMMM YYYY LT",
          },
          calendar: {
            sameDay: "[Vandag om] LT",
            nextDay: "[MÃ´re om] LT",
            nextWeek: "dddd [om] LT",
            lastDay: "[Gister om] LT",
            lastWeek: "[Laas] dddd [om] LT",
            sameElse: "L",
          },
          relativeTime: {
            future: "oor %s",
            past: "%s gelede",
            s: "'n paar sekondes",
            m: "'n minuut",
            mm: "%d minute",
            h: "'n uur",
            hh: "%d ure",
            d: "'n dag",
            dd: "%d dae",
            M: "'n maand",
            MM: "%d maande",
            y: "'n jaar",
            yy: "%d jaar",
          },
          ordinal: function (a) {
            return a + (1 === a || 8 === a || a >= 20 ? "ste" : "de");
          },
          week: { dow: 1, doy: 4 },
        });
      }),
      (function (a) {
        a(tb);
      })(function (a) {
        return a.defineLocale("ar-ma", {
          months:
            "ÙŠÙ†Ø§ÙŠØ±_ÙØ¨Ø±Ø§ÙŠØ±_Ù…Ø§Ø±Ø³_Ø£Ø¨Ø±ÙŠÙ„_Ù…Ø§ÙŠ_ÙŠÙˆÙ†ÙŠÙˆ_ÙŠÙˆÙ„ÙŠÙˆØ²_ØºØ´Øª_Ø´ØªÙ†Ø¨Ø±_Ø£ÙƒØªÙˆØ¨Ø±_Ù†ÙˆÙ†Ø¨Ø±_Ø¯Ø¬Ù†Ø¨Ø±".split(
              "_"
            ),
          monthsShort:
            "ÙŠÙ†Ø§ÙŠØ±_ÙØ¨Ø±Ø§ÙŠØ±_Ù…Ø§Ø±Ø³_Ø£Ø¨Ø±ÙŠÙ„_Ù…Ø§ÙŠ_ÙŠÙˆÙ†ÙŠÙˆ_ÙŠÙˆÙ„ÙŠÙˆØ²_ØºØ´Øª_Ø´ØªÙ†Ø¨Ø±_Ø£ÙƒØªÙˆØ¨Ø±_Ù†ÙˆÙ†Ø¨Ø±_Ø¯Ø¬Ù†Ø¨Ø±".split(
              "_"
            ),
          weekdays:
            "Ø§Ù„Ø£Ø­Ø¯_Ø§Ù„Ø¥ØªÙ†ÙŠÙ†_Ø§Ù„Ø«Ù„Ø§Ø«Ø§Ø¡_Ø§Ù„Ø£Ø±Ø¨Ø¹Ø§Ø¡_Ø§Ù„Ø®Ù…ÙŠØ³_Ø§Ù„Ø¬Ù…Ø¹Ø©_Ø§Ù„Ø³Ø¨Øª".split(
              "_"
            ),
          weekdaysShort:
            "Ø§Ø­Ø¯_Ø§ØªÙ†ÙŠÙ†_Ø«Ù„Ø§Ø«Ø§Ø¡_Ø§Ø±Ø¨Ø¹Ø§Ø¡_Ø®Ù…ÙŠØ³_Ø¬Ù…Ø¹Ø©_Ø³Ø¨Øª".split(
              "_"
            ),
          weekdaysMin: "Ø­_Ù†_Ø«_Ø±_Ø®_Ø¬_Ø³".split("_"),
          longDateFormat: {
            LT: "HH:mm",
            L: "DD/MM/YYYY",
            LL: "D MMMM YYYY",
            LLL: "D MMMM YYYY LT",
            LLLL: "dddd D MMMM YYYY LT",
          },
          calendar: {
            sameDay: "[Ø§Ù„ÙŠÙˆÙ… Ø¹Ù„Ù‰ Ø§Ù„Ø³Ø§Ø¹Ø©] LT",
            nextDay: "[ØºØ¯Ø§ Ø¹Ù„Ù‰ Ø§Ù„Ø³Ø§Ø¹Ø©] LT",
            nextWeek: "dddd [Ø¹Ù„Ù‰ Ø§Ù„Ø³Ø§Ø¹Ø©] LT",
            lastDay: "[Ø£Ù…Ø³ Ø¹Ù„Ù‰ Ø§Ù„Ø³Ø§Ø¹Ø©] LT",
            lastWeek: "dddd [Ø¹Ù„Ù‰ Ø§Ù„Ø³Ø§Ø¹Ø©] LT",
            sameElse: "L",
          },
          relativeTime: {
            future: "ÙÙŠ %s",
            past: "Ù…Ù†Ø° %s",
            s: "Ø«ÙˆØ§Ù†",
            m: "Ø¯Ù‚ÙŠÙ‚Ø©",
            mm: "%d Ø¯Ù‚Ø§Ø¦Ù‚",
            h: "Ø³Ø§Ø¹Ø©",
            hh: "%d Ø³Ø§Ø¹Ø§Øª",
            d: "ÙŠÙˆÙ…",
            dd: "%d Ø£ÙŠØ§Ù…",
            M: "Ø´Ù‡Ø±",
            MM: "%d Ø£Ø´Ù‡Ø±",
            y: "Ø³Ù†Ø©",
            yy: "%d Ø³Ù†ÙˆØ§Øª",
          },
          week: { dow: 6, doy: 12 },
        });
      }),
      (function (a) {
        a(tb);
      })(function (a) {
        var b = {
            1: "Ù¡",
            2: "Ù¢",
            3: "Ù£",
            4: "Ù¤",
            5: "Ù¥",
            6: "Ù¦",
            7: "Ù§",
            8: "Ù¨",
            9: "Ù©",
            0: "Ù ",
          },
          c = {
            "Ù¡": "1",
            "Ù¢": "2",
            "Ù£": "3",
            "Ù¤": "4",
            "Ù¥": "5",
            "Ù¦": "6",
            "Ù§": "7",
            "Ù¨": "8",
            "Ù©": "9",
            "Ù ": "0",
          };
        return a.defineLocale("ar-sa", {
          months:
            "ÙŠÙ†Ø§ÙŠØ±_ÙØ¨Ø±Ø§ÙŠØ±_Ù…Ø§Ø±Ø³_Ø£Ø¨Ø±ÙŠÙ„_Ù…Ø§ÙŠÙˆ_ÙŠÙˆÙ†ÙŠÙˆ_ÙŠÙˆÙ„ÙŠÙˆ_Ø£ØºØ³Ø·Ø³_Ø³Ø¨ØªÙ…Ø¨Ø±_Ø£ÙƒØªÙˆØ¨Ø±_Ù†ÙˆÙÙ…Ø¨Ø±_Ø¯ÙŠØ³Ù…Ø¨Ø±".split(
              "_"
            ),
          monthsShort:
            "ÙŠÙ†Ø§ÙŠØ±_ÙØ¨Ø±Ø§ÙŠØ±_Ù…Ø§Ø±Ø³_Ø£Ø¨Ø±ÙŠÙ„_Ù…Ø§ÙŠÙˆ_ÙŠÙˆÙ†ÙŠÙˆ_ÙŠÙˆÙ„ÙŠÙˆ_Ø£ØºØ³Ø·Ø³_Ø³Ø¨ØªÙ…Ø¨Ø±_Ø£ÙƒØªÙˆØ¨Ø±_Ù†ÙˆÙÙ…Ø¨Ø±_Ø¯ÙŠØ³Ù…Ø¨Ø±".split(
              "_"
            ),
          weekdays:
            "Ø§Ù„Ø£Ø­Ø¯_Ø§Ù„Ø¥Ø«Ù†ÙŠÙ†_Ø§Ù„Ø«Ù„Ø§Ø«Ø§Ø¡_Ø§Ù„Ø£Ø±Ø¨Ø¹Ø§Ø¡_Ø§Ù„Ø®Ù…ÙŠØ³_Ø§Ù„Ø¬Ù…Ø¹Ø©_Ø§Ù„Ø³Ø¨Øª".split(
              "_"
            ),
          weekdaysShort:
            "Ø£Ø­Ø¯_Ø¥Ø«Ù†ÙŠÙ†_Ø«Ù„Ø§Ø«Ø§Ø¡_Ø£Ø±Ø¨Ø¹Ø§Ø¡_Ø®Ù…ÙŠØ³_Ø¬Ù…Ø¹Ø©_Ø³Ø¨Øª".split(
              "_"
            ),
          weekdaysMin: "Ø­_Ù†_Ø«_Ø±_Ø®_Ø¬_Ø³".split("_"),
          longDateFormat: {
            LT: "HH:mm",
            L: "DD/MM/YYYY",
            LL: "D MMMM YYYY",
            LLL: "D MMMM YYYY LT",
            LLLL: "dddd D MMMM YYYY LT",
          },
          meridiem: function (a) {
            return 12 > a ? "Øµ" : "Ù…";
          },
          calendar: {
            sameDay: "[Ø§Ù„ÙŠÙˆÙ… Ø¹Ù„Ù‰ Ø§Ù„Ø³Ø§Ø¹Ø©] LT",
            nextDay: "[ØºØ¯Ø§ Ø¹Ù„Ù‰ Ø§Ù„Ø³Ø§Ø¹Ø©] LT",
            nextWeek: "dddd [Ø¹Ù„Ù‰ Ø§Ù„Ø³Ø§Ø¹Ø©] LT",
            lastDay: "[Ø£Ù…Ø³ Ø¹Ù„Ù‰ Ø§Ù„Ø³Ø§Ø¹Ø©] LT",
            lastWeek: "dddd [Ø¹Ù„Ù‰ Ø§Ù„Ø³Ø§Ø¹Ø©] LT",
            sameElse: "L",
          },
          relativeTime: {
            future: "ÙÙŠ %s",
            past: "Ù…Ù†Ø° %s",
            s: "Ø«ÙˆØ§Ù†",
            m: "Ø¯Ù‚ÙŠÙ‚Ø©",
            mm: "%d Ø¯Ù‚Ø§Ø¦Ù‚",
            h: "Ø³Ø§Ø¹Ø©",
            hh: "%d Ø³Ø§Ø¹Ø§Øª",
            d: "ÙŠÙˆÙ…",
            dd: "%d Ø£ÙŠØ§Ù…",
            M: "Ø´Ù‡Ø±",
            MM: "%d Ø£Ø´Ù‡Ø±",
            y: "Ø³Ù†Ø©",
            yy: "%d Ø³Ù†ÙˆØ§Øª",
          },
          preparse: function (a) {
            return a
              .replace(/[Û°-Û¹]/g, function (a) {
                return c[a];
              })
              .replace(/ØŒ/g, ",");
          },
          postformat: function (a) {
            return a
              .replace(/\d/g, function (a) {
                return b[a];
              })
              .replace(/,/g, "ØŒ");
          },
          week: { dow: 6, doy: 12 },
        });
      }),
      (function (a) {
        a(tb);
      })(function (a) {
        var b = {
            1: "Ù¡",
            2: "Ù¢",
            3: "Ù£",
            4: "Ù¤",
            5: "Ù¥",
            6: "Ù¦",
            7: "Ù§",
            8: "Ù¨",
            9: "Ù©",
            0: "Ù ",
          },
          c = {
            "Ù¡": "1",
            "Ù¢": "2",
            "Ù£": "3",
            "Ù¤": "4",
            "Ù¥": "5",
            "Ù¦": "6",
            "Ù§": "7",
            "Ù¨": "8",
            "Ù©": "9",
            "Ù ": "0",
          },
          d = function (a) {
            return 0 === a
              ? 0
              : 1 === a
              ? 1
              : 2 === a
              ? 2
              : a % 100 >= 3 && 10 >= a % 100
              ? 3
              : a % 100 >= 11
              ? 4
              : 5;
          },
          e = {
            s: [
              "Ø£Ù‚Ù„ Ù…Ù† Ø«Ø§Ù†ÙŠØ©",
              "Ø«Ø§Ù†ÙŠØ© ÙˆØ§Ø­Ø¯Ø©",
              ["Ø«Ø§Ù†ÙŠØªØ§Ù†", "Ø«Ø§Ù†ÙŠØªÙŠÙ†"],
              "%d Ø«ÙˆØ§Ù†",
              "%d Ø«Ø§Ù†ÙŠØ©",
              "%d Ø«Ø§Ù†ÙŠØ©",
            ],
            m: [
              "Ø£Ù‚Ù„ Ù…Ù† Ø¯Ù‚ÙŠÙ‚Ø©",
              "Ø¯Ù‚ÙŠÙ‚Ø© ÙˆØ§Ø­Ø¯Ø©",
              ["Ø¯Ù‚ÙŠÙ‚ØªØ§Ù†", "Ø¯Ù‚ÙŠÙ‚ØªÙŠÙ†"],
              "%d Ø¯Ù‚Ø§Ø¦Ù‚",
              "%d Ø¯Ù‚ÙŠÙ‚Ø©",
              "%d Ø¯Ù‚ÙŠÙ‚Ø©",
            ],
            h: [
              "Ø£Ù‚Ù„ Ù…Ù† Ø³Ø§Ø¹Ø©",
              "Ø³Ø§Ø¹Ø© ÙˆØ§Ø­Ø¯Ø©",
              ["Ø³Ø§Ø¹ØªØ§Ù†", "Ø³Ø§Ø¹ØªÙŠÙ†"],
              "%d Ø³Ø§Ø¹Ø§Øª",
              "%d Ø³Ø§Ø¹Ø©",
              "%d Ø³Ø§Ø¹Ø©",
            ],
            d: [
              "Ø£Ù‚Ù„ Ù…Ù† ÙŠÙˆÙ…",
              "ÙŠÙˆÙ… ÙˆØ§Ø­Ø¯",
              ["ÙŠÙˆÙ…Ø§Ù†", "ÙŠÙˆÙ…ÙŠÙ†"],
              "%d Ø£ÙŠØ§Ù…",
              "%d ÙŠÙˆÙ…Ù‹Ø§",
              "%d ÙŠÙˆÙ…",
            ],
            M: [
              "Ø£Ù‚Ù„ Ù…Ù† Ø´Ù‡Ø±",
              "Ø´Ù‡Ø± ÙˆØ§Ø­Ø¯",
              ["Ø´Ù‡Ø±Ø§Ù†", "Ø´Ù‡Ø±ÙŠÙ†"],
              "%d Ø£Ø´Ù‡Ø±",
              "%d Ø´Ù‡Ø±Ø§",
              "%d Ø´Ù‡Ø±",
            ],
            y: [
              "Ø£Ù‚Ù„ Ù…Ù† Ø¹Ø§Ù…",
              "Ø¹Ø§Ù… ÙˆØ§Ø­Ø¯",
              ["Ø¹Ø§Ù…Ø§Ù†", "Ø¹Ø§Ù…ÙŠÙ†"],
              "%d Ø£Ø¹ÙˆØ§Ù…",
              "%d Ø¹Ø§Ù…Ù‹Ø§",
              "%d Ø¹Ø§Ù…",
            ],
          },
          f = function (a) {
            return function (b, c) {
              var f = d(b),
                g = e[a][d(b)];
              return 2 === f && (g = g[c ? 0 : 1]), g.replace(/%d/i, b);
            };
          },
          g = [
            "ÙƒØ§Ù†ÙˆÙ† Ø§Ù„Ø«Ø§Ù†ÙŠ ÙŠÙ†Ø§ÙŠØ±",
            "Ø´Ø¨Ø§Ø· ÙØ¨Ø±Ø§ÙŠØ±",
            "Ø¢Ø°Ø§Ø± Ù…Ø§Ø±Ø³",
            "Ù†ÙŠØ³Ø§Ù† Ø£Ø¨Ø±ÙŠÙ„",
            "Ø£ÙŠØ§Ø± Ù…Ø§ÙŠÙˆ",
            "Ø­Ø²ÙŠØ±Ø§Ù† ÙŠÙˆÙ†ÙŠÙˆ",
            "ØªÙ…ÙˆØ² ÙŠÙˆÙ„ÙŠÙˆ",
            "Ø¢Ø¨ Ø£ØºØ³Ø·Ø³",
            "Ø£ÙŠÙ„ÙˆÙ„ Ø³Ø¨ØªÙ…Ø¨Ø±",
            "ØªØ´Ø±ÙŠÙ† Ø§Ù„Ø£ÙˆÙ„ Ø£ÙƒØªÙˆØ¨Ø±",
            "ØªØ´Ø±ÙŠÙ† Ø§Ù„Ø«Ø§Ù†ÙŠ Ù†ÙˆÙÙ…Ø¨Ø±",
            "ÙƒØ§Ù†ÙˆÙ† Ø§Ù„Ø£ÙˆÙ„ Ø¯ÙŠØ³Ù…Ø¨Ø±",
          ];
        return a.defineLocale("ar", {
          months: g,
          monthsShort: g,
          weekdays:
            "Ø§Ù„Ø£Ø­Ø¯_Ø§Ù„Ø¥Ø«Ù†ÙŠÙ†_Ø§Ù„Ø«Ù„Ø§Ø«Ø§Ø¡_Ø§Ù„Ø£Ø±Ø¨Ø¹Ø§Ø¡_Ø§Ù„Ø®Ù…ÙŠØ³_Ø§Ù„Ø¬Ù…Ø¹Ø©_Ø§Ù„Ø³Ø¨Øª".split(
              "_"
            ),
          weekdaysShort:
            "Ø£Ø­Ø¯_Ø¥Ø«Ù†ÙŠÙ†_Ø«Ù„Ø§Ø«Ø§Ø¡_Ø£Ø±Ø¨Ø¹Ø§Ø¡_Ø®Ù…ÙŠØ³_Ø¬Ù…Ø¹Ø©_Ø³Ø¨Øª".split(
              "_"
            ),
          weekdaysMin: "Ø­_Ù†_Ø«_Ø±_Ø®_Ø¬_Ø³".split("_"),
          longDateFormat: {
            LT: "HH:mm",
            L: "DD/MM/YYYY",
            LL: "D MMMM YYYY",
            LLL: "D MMMM YYYY LT",
            LLLL: "dddd D MMMM YYYY LT",
          },
          meridiem: function (a) {
            return 12 > a ? "Øµ" : "Ù…";
          },
          calendar: {
            sameDay: "[Ø§Ù„ÙŠÙˆÙ… Ø¹Ù†Ø¯ Ø§Ù„Ø³Ø§Ø¹Ø©] LT",
            nextDay: "[ØºØ¯Ù‹Ø§ Ø¹Ù†Ø¯ Ø§Ù„Ø³Ø§Ø¹Ø©] LT",
            nextWeek: "dddd [Ø¹Ù†Ø¯ Ø§Ù„Ø³Ø§Ø¹Ø©] LT",
            lastDay: "[Ø£Ù…Ø³ Ø¹Ù†Ø¯ Ø§Ù„Ø³Ø§Ø¹Ø©] LT",
            lastWeek: "dddd [Ø¹Ù†Ø¯ Ø§Ù„Ø³Ø§Ø¹Ø©] LT",
            sameElse: "L",
          },
          relativeTime: {
            future: "Ø¨Ø¹Ø¯ %s",
            past: "Ù…Ù†Ø° %s",
            s: f("s"),
            m: f("m"),
            mm: f("m"),
            h: f("h"),
            hh: f("h"),
            d: f("d"),
            dd: f("d"),
            M: f("M"),
            MM: f("M"),
            y: f("y"),
            yy: f("y"),
          },
          preparse: function (a) {
            return a
              .replace(/[Û°-Û¹]/g, function (a) {
                return c[a];
              })
              .replace(/ØŒ/g, ",");
          },
          postformat: function (a) {
            return a
              .replace(/\d/g, function (a) {
                return b[a];
              })
              .replace(/,/g, "ØŒ");
          },
          week: { dow: 6, doy: 12 },
        });
      }),
      (function (a) {
        a(tb);
      })(function (a) {
        var b = {
          1: "-inci",
          5: "-inci",
          8: "-inci",
          70: "-inci",
          80: "-inci",
          2: "-nci",
          7: "-nci",
          20: "-nci",
          50: "-nci",
          3: "-Ã¼ncÃ¼",
          4: "-Ã¼ncÃ¼",
          100: "-Ã¼ncÃ¼",
          6: "-ncÄ±",
          9: "-uncu",
          10: "-uncu",
          30: "-uncu",
          60: "-Ä±ncÄ±",
          90: "-Ä±ncÄ±",
        };
        return a.defineLocale("az", {
          months:
            "yanvar_fevral_mart_aprel_may_iyun_iyul_avqust_sentyabr_oktyabr_noyabr_dekabr".split(
              "_"
            ),
          monthsShort: "yan_fev_mar_apr_may_iyn_iyl_avq_sen_okt_noy_dek".split(
            "_"
          ),
          weekdays:
            "Bazar_Bazar ertÉ™si_Ã‡É™rÅŸÉ™nbÉ™ axÅŸamÄ±_Ã‡É™rÅŸÉ™nbÉ™_CÃ¼mÉ™ axÅŸamÄ±_CÃ¼mÉ™_ÅžÉ™nbÉ™".split(
              "_"
            ),
          weekdaysShort: "Baz_BzE_Ã‡Ax_Ã‡É™r_CAx_CÃ¼m_ÅžÉ™n".split("_"),
          weekdaysMin: "Bz_BE_Ã‡A_Ã‡É™_CA_CÃ¼_ÅžÉ™".split("_"),
          longDateFormat: {
            LT: "HH:mm",
            L: "DD.MM.YYYY",
            LL: "D MMMM YYYY",
            LLL: "D MMMM YYYY LT",
            LLLL: "dddd, D MMMM YYYY LT",
          },
          calendar: {
            sameDay: "[bugÃ¼n saat] LT",
            nextDay: "[sabah saat] LT",
            nextWeek: "[gÉ™lÉ™n hÉ™ftÉ™] dddd [saat] LT",
            lastDay: "[dÃ¼nÉ™n] LT",
            lastWeek: "[keÃ§É™n hÉ™ftÉ™] dddd [saat] LT",
            sameElse: "L",
          },
          relativeTime: {
            future: "%s sonra",
            past: "%s É™vvÉ™l",
            s: "birneÃ§É™ saniyyÉ™",
            m: "bir dÉ™qiqÉ™",
            mm: "%d dÉ™qiqÉ™",
            h: "bir saat",
            hh: "%d saat",
            d: "bir gÃ¼n",
            dd: "%d gÃ¼n",
            M: "bir ay",
            MM: "%d ay",
            y: "bir il",
            yy: "%d il",
          },
          meridiem: function (a) {
            return 4 > a
              ? "gecÉ™"
              : 12 > a
              ? "sÉ™hÉ™r"
              : 17 > a
              ? "gÃ¼ndÃ¼z"
              : "axÅŸam";
          },
          ordinal: function (a) {
            if (0 === a) return a + "-Ä±ncÄ±";
            var c = a % 10,
              d = (a % 100) - c,
              e = a >= 100 ? 100 : null;
            return a + (b[c] || b[d] || b[e]);
          },
          week: { dow: 1, doy: 7 },
        });
      }),
      (function (a) {
        a(tb);
      })(function (a) {
        function b(a, b) {
          var c = a.split("_");
          return b % 10 === 1 && b % 100 !== 11
            ? c[0]
            : b % 10 >= 2 && 4 >= b % 10 && (10 > b % 100 || b % 100 >= 20)
            ? c[1]
            : c[2];
        }
        function c(a, c, d) {
          var e = {
            mm: c
              ? "Ñ…Ð²Ñ–Ð»Ñ–Ð½Ð°_Ñ…Ð²Ñ–Ð»Ñ–Ð½Ñ‹_Ñ…Ð²Ñ–Ð»Ñ–Ð½"
              : "Ñ…Ð²Ñ–Ð»Ñ–Ð½Ñƒ_Ñ…Ð²Ñ–Ð»Ñ–Ð½Ñ‹_Ñ…Ð²Ñ–Ð»Ñ–Ð½",
            hh: c
              ? "Ð³Ð°Ð´Ð·Ñ–Ð½Ð°_Ð³Ð°Ð´Ð·Ñ–Ð½Ñ‹_Ð³Ð°Ð´Ð·Ñ–Ð½"
              : "Ð³Ð°Ð´Ð·Ñ–Ð½Ñƒ_Ð³Ð°Ð´Ð·Ñ–Ð½Ñ‹_Ð³Ð°Ð´Ð·Ñ–Ð½",
            dd: "Ð´Ð·ÐµÐ½ÑŒ_Ð´Ð½Ñ–_Ð´Ð·Ñ‘Ð½",
            MM: "Ð¼ÐµÑÑÑ†_Ð¼ÐµÑÑÑ†Ñ‹_Ð¼ÐµÑÑÑ†Ð°Ñž",
            yy: "Ð³Ð¾Ð´_Ð³Ð°Ð´Ñ‹_Ð³Ð°Ð´Ð¾Ñž",
          };
          return "m" === d
            ? c
              ? "Ñ…Ð²Ñ–Ð»Ñ–Ð½Ð°"
              : "Ñ…Ð²Ñ–Ð»Ñ–Ð½Ñƒ"
            : "h" === d
            ? c
              ? "Ð³Ð°Ð´Ð·Ñ–Ð½Ð°"
              : "Ð³Ð°Ð´Ð·Ñ–Ð½Ñƒ"
            : a + " " + b(e[d], +a);
        }
        function d(a, b) {
          var c = {
              nominative:
                "ÑÑ‚ÑƒÐ´Ð·ÐµÐ½ÑŒ_Ð»ÑŽÑ‚Ñ‹_ÑÐ°ÐºÐ°Ð²Ñ–Ðº_ÐºÑ€Ð°ÑÐ°Ð²Ñ–Ðº_Ñ‚Ñ€Ð°Ð²ÐµÐ½ÑŒ_Ñ‡ÑÑ€Ð²ÐµÐ½ÑŒ_Ð»Ñ–Ð¿ÐµÐ½ÑŒ_Ð¶Ð½Ñ–Ð²ÐµÐ½ÑŒ_Ð²ÐµÑ€Ð°ÑÐµÐ½ÑŒ_ÐºÐ°ÑÑ‚Ñ€Ñ‹Ñ‡Ð½Ñ–Ðº_Ð»Ñ–ÑÑ‚Ð°Ð¿Ð°Ð´_ÑÐ½ÐµÐ¶Ð°Ð½ÑŒ".split(
                  "_"
                ),
              accusative:
                "ÑÑ‚ÑƒÐ´Ð·ÐµÐ½Ñ_Ð»ÑŽÑ‚Ð°Ð³Ð°_ÑÐ°ÐºÐ°Ð²Ñ–ÐºÐ°_ÐºÑ€Ð°ÑÐ°Ð²Ñ–ÐºÐ°_Ñ‚Ñ€Ð°ÑžÐ½Ñ_Ñ‡ÑÑ€Ð²ÐµÐ½Ñ_Ð»Ñ–Ð¿ÐµÐ½Ñ_Ð¶Ð½Ñ–ÑžÐ½Ñ_Ð²ÐµÑ€Ð°ÑÐ½Ñ_ÐºÐ°ÑÑ‚Ñ€Ñ‹Ñ‡Ð½Ñ–ÐºÐ°_Ð»Ñ–ÑÑ‚Ð°Ð¿Ð°Ð´Ð°_ÑÐ½ÐµÐ¶Ð½Ñ".split(
                  "_"
                ),
            },
            d = /D[oD]?(\[[^\[\]]*\]|\s+)+MMMM?/.test(b)
              ? "accusative"
              : "nominative";
          return c[d][a.month()];
        }
        function e(a, b) {
          var c = {
              nominative:
                "Ð½ÑÐ´Ð·ÐµÐ»Ñ_Ð¿Ð°Ð½ÑÐ´Ð·ÐµÐ»Ð°Ðº_Ð°ÑžÑ‚Ð¾Ñ€Ð°Ðº_ÑÐµÑ€Ð°Ð´Ð°_Ñ‡Ð°Ñ†Ð²ÐµÑ€_Ð¿ÑÑ‚Ð½Ñ–Ñ†Ð°_ÑÑƒÐ±Ð¾Ñ‚Ð°".split(
                  "_"
                ),
              accusative:
                "Ð½ÑÐ´Ð·ÐµÐ»ÑŽ_Ð¿Ð°Ð½ÑÐ´Ð·ÐµÐ»Ð°Ðº_Ð°ÑžÑ‚Ð¾Ñ€Ð°Ðº_ÑÐµÑ€Ð°Ð´Ñƒ_Ñ‡Ð°Ñ†Ð²ÐµÑ€_Ð¿ÑÑ‚Ð½Ñ–Ñ†Ñƒ_ÑÑƒÐ±Ð¾Ñ‚Ñƒ".split(
                  "_"
                ),
            },
            d =
              /\[ ?[Ð’Ð²] ?(?:Ð¼Ñ–Ð½ÑƒÐ»ÑƒÑŽ|Ð½Ð°ÑÑ‚ÑƒÐ¿Ð½ÑƒÑŽ)? ?\] ?dddd/.test(
                b
              )
                ? "accusative"
                : "nominative";
          return c[d][a.day()];
        }
        return a.defineLocale("be", {
          months: d,
          monthsShort:
            "ÑÑ‚ÑƒÐ´_Ð»ÑŽÑ‚_ÑÐ°Ðº_ÐºÑ€Ð°Ñ_Ñ‚Ñ€Ð°Ð²_Ñ‡ÑÑ€Ð²_Ð»Ñ–Ð¿_Ð¶Ð½Ñ–Ð²_Ð²ÐµÑ€_ÐºÐ°ÑÑ‚_Ð»Ñ–ÑÑ‚_ÑÐ½ÐµÐ¶".split(
              "_"
            ),
          weekdays: e,
          weekdaysShort: "Ð½Ð´_Ð¿Ð½_Ð°Ñ‚_ÑÑ€_Ñ‡Ñ†_Ð¿Ñ‚_ÑÐ±".split("_"),
          weekdaysMin: "Ð½Ð´_Ð¿Ð½_Ð°Ñ‚_ÑÑ€_Ñ‡Ñ†_Ð¿Ñ‚_ÑÐ±".split("_"),
          longDateFormat: {
            LT: "HH:mm",
            L: "DD.MM.YYYY",
            LL: "D MMMM YYYY Ð³.",
            LLL: "D MMMM YYYY Ð³., LT",
            LLLL: "dddd, D MMMM YYYY Ð³., LT",
          },
          calendar: {
            sameDay: "[Ð¡Ñ‘Ð½Ð½Ñ Ñž] LT",
            nextDay: "[Ð—Ð°ÑžÑ‚Ñ€Ð° Ñž] LT",
            lastDay: "[Ð£Ñ‡Ð¾Ñ€Ð° Ñž] LT",
            nextWeek: function () {
              return "[Ð£] dddd [Ñž] LT";
            },
            lastWeek: function () {
              switch (this.day()) {
                case 0:
                case 3:
                case 5:
                case 6:
                  return "[Ð£ Ð¼Ñ–Ð½ÑƒÐ»ÑƒÑŽ] dddd [Ñž] LT";
                case 1:
                case 2:
                case 4:
                  return "[Ð£ Ð¼Ñ–Ð½ÑƒÐ»Ñ‹] dddd [Ñž] LT";
              }
            },
            sameElse: "L",
          },
          relativeTime: {
            future: "Ð¿Ñ€Ð°Ð· %s",
            past: "%s Ñ‚Ð°Ð¼Ñƒ",
            s: "Ð½ÐµÐºÐ°Ð»ÑŒÐºÑ– ÑÐµÐºÑƒÐ½Ð´",
            m: c,
            mm: c,
            h: c,
            hh: c,
            d: "Ð´Ð·ÐµÐ½ÑŒ",
            dd: c,
            M: "Ð¼ÐµÑÑÑ†",
            MM: c,
            y: "Ð³Ð¾Ð´",
            yy: c,
          },
          meridiem: function (a) {
            return 4 > a
              ? "Ð½Ð¾Ñ‡Ñ‹"
              : 12 > a
              ? "Ñ€Ð°Ð½Ñ–Ñ†Ñ‹"
              : 17 > a
              ? "Ð´Ð½Ñ"
              : "Ð²ÐµÑ‡Ð°Ñ€Ð°";
          },
          ordinal: function (a, b) {
            switch (b) {
              case "M":
              case "d":
              case "DDD":
              case "w":
              case "W":
                return (a % 10 !== 2 && a % 10 !== 3) ||
                  a % 100 === 12 ||
                  a % 100 === 13
                  ? a + "-Ñ‹"
                  : a + "-Ñ–";
              case "D":
                return a + "-Ð³Ð°";
              default:
                return a;
            }
          },
          week: { dow: 1, doy: 7 },
        });
      }),
      (function (a) {
        a(tb);
      })(function (a) {
        return a.defineLocale("bg", {
          months:
            "ÑÐ½ÑƒÐ°Ñ€Ð¸_Ñ„ÐµÐ²Ñ€ÑƒÐ°Ñ€Ð¸_Ð¼Ð°Ñ€Ñ‚_Ð°Ð¿Ñ€Ð¸Ð»_Ð¼Ð°Ð¹_ÑŽÐ½Ð¸_ÑŽÐ»Ð¸_Ð°Ð²Ð³ÑƒÑÑ‚_ÑÐµÐ¿Ñ‚ÐµÐ¼Ð²Ñ€Ð¸_Ð¾ÐºÑ‚Ð¾Ð¼Ð²Ñ€Ð¸_Ð½Ð¾ÐµÐ¼Ð²Ñ€Ð¸_Ð´ÐµÐºÐµÐ¼Ð²Ñ€Ð¸".split(
              "_"
            ),
          monthsShort:
            "ÑÐ½Ñ€_Ñ„ÐµÐ²_Ð¼Ð°Ñ€_Ð°Ð¿Ñ€_Ð¼Ð°Ð¹_ÑŽÐ½Ð¸_ÑŽÐ»Ð¸_Ð°Ð²Ð³_ÑÐµÐ¿_Ð¾ÐºÑ‚_Ð½Ð¾Ðµ_Ð´ÐµÐº".split(
              "_"
            ),
          weekdays:
            "Ð½ÐµÐ´ÐµÐ»Ñ_Ð¿Ð¾Ð½ÐµÐ´ÐµÐ»Ð½Ð¸Ðº_Ð²Ñ‚Ð¾Ñ€Ð½Ð¸Ðº_ÑÑ€ÑÐ´Ð°_Ñ‡ÐµÑ‚Ð²ÑŠÑ€Ñ‚ÑŠÐº_Ð¿ÐµÑ‚ÑŠÐº_ÑÑŠÐ±Ð¾Ñ‚Ð°".split(
              "_"
            ),
          weekdaysShort: "Ð½ÐµÐ´_Ð¿Ð¾Ð½_Ð²Ñ‚Ð¾_ÑÑ€Ñ_Ñ‡ÐµÑ‚_Ð¿ÐµÑ‚_ÑÑŠÐ±".split(
            "_"
          ),
          weekdaysMin: "Ð½Ð´_Ð¿Ð½_Ð²Ñ‚_ÑÑ€_Ñ‡Ñ‚_Ð¿Ñ‚_ÑÐ±".split("_"),
          longDateFormat: {
            LT: "H:mm",
            L: "D.MM.YYYY",
            LL: "D MMMM YYYY",
            LLL: "D MMMM YYYY LT",
            LLLL: "dddd, D MMMM YYYY LT",
          },
          calendar: {
            sameDay: "[Ð”Ð½ÐµÑ Ð²] LT",
            nextDay: "[Ð£Ñ‚Ñ€Ðµ Ð²] LT",
            nextWeek: "dddd [Ð²] LT",
            lastDay: "[Ð’Ñ‡ÐµÑ€Ð° Ð²] LT",
            lastWeek: function () {
              switch (this.day()) {
                case 0:
                case 3:
                case 6:
                  return "[Ð’ Ð¸Ð·Ð¼Ð¸Ð½Ð°Ð»Ð°Ñ‚Ð°] dddd [Ð²] LT";
                case 1:
                case 2:
                case 4:
                case 5:
                  return "[Ð’ Ð¸Ð·Ð¼Ð¸Ð½Ð°Ð»Ð¸Ñ] dddd [Ð²] LT";
              }
            },
            sameElse: "L",
          },
          relativeTime: {
            future: "ÑÐ»ÐµÐ´ %s",
            past: "Ð¿Ñ€ÐµÐ´Ð¸ %s",
            s: "Ð½ÑÐºÐ¾Ð»ÐºÐ¾ ÑÐµÐºÑƒÐ½Ð´Ð¸",
            m: "Ð¼Ð¸Ð½ÑƒÑ‚Ð°",
            mm: "%d Ð¼Ð¸Ð½ÑƒÑ‚Ð¸",
            h: "Ñ‡Ð°Ñ",
            hh: "%d Ñ‡Ð°ÑÐ°",
            d: "Ð´ÐµÐ½",
            dd: "%d Ð´Ð½Ð¸",
            M: "Ð¼ÐµÑÐµÑ†",
            MM: "%d Ð¼ÐµÑÐµÑ†Ð°",
            y: "Ð³Ð¾Ð´Ð¸Ð½Ð°",
            yy: "%d Ð³Ð¾Ð´Ð¸Ð½Ð¸",
          },
          ordinal: function (a) {
            var b = a % 10,
              c = a % 100;
            return 0 === a
              ? a + "-ÐµÐ²"
              : 0 === c
              ? a + "-ÐµÐ½"
              : c > 10 && 20 > c
              ? a + "-Ñ‚Ð¸"
              : 1 === b
              ? a + "-Ð²Ð¸"
              : 2 === b
              ? a + "-Ñ€Ð¸"
              : 7 === b || 8 === b
              ? a + "-Ð¼Ð¸"
              : a + "-Ñ‚Ð¸";
          },
          week: { dow: 1, doy: 7 },
        });
      }),
      (function (a) {
        a(tb);
      })(function (a) {
        var b = {
            1: "à§§",
            2: "à§¨",
            3: "à§©",
            4: "à§ª",
            5: "à§«",
            6: "à§¬",
            7: "à§­",
            8: "à§®",
            9: "à§¯",
            0: "à§¦",
          },
          c = {
            "à§§": "1",
            "à§¨": "2",
            "à§©": "3",
            "à§ª": "4",
            "à§«": "5",
            "à§¬": "6",
            "à§­": "7",
            "à§®": "8",
            "à§¯": "9",
            "à§¦": "0",
          };
        return a.defineLocale("bn", {
          months:
            "à¦œà¦¾à¦¨à§à§Ÿà¦¾à¦°à§€_à¦«à§‡à¦¬à§à§Ÿà¦¾à¦°à§€_à¦®à¦¾à¦°à§à¦š_à¦à¦ªà§à¦°à¦¿à¦²_à¦®à§‡_à¦œà§à¦¨_à¦œà§à¦²à¦¾à¦‡_à¦…à¦—à¦¾à¦¸à§à¦Ÿ_à¦¸à§‡à¦ªà§à¦Ÿà§‡à¦®à§à¦¬à¦°_à¦…à¦•à§à¦Ÿà§‹à¦¬à¦°_à¦¨à¦­à§‡à¦®à§à¦¬à¦°_à¦¡à¦¿à¦¸à§‡à¦®à§à¦¬à¦°".split(
              "_"
            ),
          monthsShort:
            "à¦œà¦¾à¦¨à§_à¦«à§‡à¦¬_à¦®à¦¾à¦°à§à¦š_à¦à¦ªà¦°_à¦®à§‡_à¦œà§à¦¨_à¦œà§à¦²_à¦…à¦—_à¦¸à§‡à¦ªà§à¦Ÿ_à¦…à¦•à§à¦Ÿà§‹_à¦¨à¦­_à¦¡à¦¿à¦¸à§‡à¦®à§".split(
              "_"
            ),
          weekdays:
            "à¦°à¦¬à¦¿à¦¬à¦¾à¦°_à¦¸à§‹à¦®à¦¬à¦¾à¦°_à¦®à¦™à§à¦—à¦²à¦¬à¦¾à¦°_à¦¬à§à¦§à¦¬à¦¾à¦°_à¦¬à§ƒà¦¹à¦¸à§à¦ªà¦¤à§à¦¤à¦¿à¦¬à¦¾à¦°_à¦¶à§à¦•à§à¦°à§à¦¬à¦¾à¦°_à¦¶à¦¨à¦¿à¦¬à¦¾à¦°".split(
              "_"
            ),
          weekdaysShort:
            "à¦°à¦¬à¦¿_à¦¸à§‹à¦®_à¦®à¦™à§à¦—à¦²_à¦¬à§à¦§_à¦¬à§ƒà¦¹à¦¸à§à¦ªà¦¤à§à¦¤à¦¿_à¦¶à§à¦•à§à¦°à§_à¦¶à¦¨à¦¿".split(
              "_"
            ),
          weekdaysMin:
            "à¦°à¦¬_à¦¸à¦®_à¦®à¦™à§à¦—_à¦¬à§_à¦¬à§à¦°à¦¿à¦¹_à¦¶à§_à¦¶à¦¨à¦¿".split(
              "_"
            ),
          longDateFormat: {
            LT: "A h:mm à¦¸à¦®à§Ÿ",
            L: "DD/MM/YYYY",
            LL: "D MMMM YYYY",
            LLL: "D MMMM YYYY, LT",
            LLLL: "dddd, D MMMM YYYY, LT",
          },
          calendar: {
            sameDay: "[à¦†à¦œ] LT",
            nextDay: "[à¦†à¦—à¦¾à¦®à§€à¦•à¦¾à¦²] LT",
            nextWeek: "dddd, LT",
            lastDay: "[à¦—à¦¤à¦•à¦¾à¦²] LT",
            lastWeek: "[à¦—à¦¤] dddd, LT",
            sameElse: "L",
          },
          relativeTime: {
            future: "%s à¦ªà¦°à§‡",
            past: "%s à¦†à¦—à§‡",
            s: "à¦•à¦à¦• à¦¸à§‡à¦•à§‡à¦¨à§à¦¡",
            m: "à¦à¦• à¦®à¦¿à¦¨à¦¿à¦Ÿ",
            mm: "%d à¦®à¦¿à¦¨à¦¿à¦Ÿ",
            h: "à¦à¦• à¦˜à¦¨à§à¦Ÿà¦¾",
            hh: "%d à¦˜à¦¨à§à¦Ÿà¦¾",
            d: "à¦à¦• à¦¦à¦¿à¦¨",
            dd: "%d à¦¦à¦¿à¦¨",
            M: "à¦à¦• à¦®à¦¾à¦¸",
            MM: "%d à¦®à¦¾à¦¸",
            y: "à¦à¦• à¦¬à¦›à¦°",
            yy: "%d à¦¬à¦›à¦°",
          },
          preparse: function (a) {
            return a.replace(/[à§§à§¨à§©à§ªà§«à§¬à§­à§®à§¯à§¦]/g, function (a) {
              return c[a];
            });
          },
          postformat: function (a) {
            return a.replace(/\d/g, function (a) {
              return b[a];
            });
          },
          meridiem: function (a) {
            return 4 > a
              ? "à¦°à¦¾à¦¤"
              : 10 > a
              ? "à¦¶à¦•à¦¾à¦²"
              : 17 > a
              ? "à¦¦à§à¦ªà§à¦°"
              : 20 > a
              ? "à¦¬à¦¿à¦•à§‡à¦²"
              : "à¦°à¦¾à¦¤";
          },
          week: { dow: 0, doy: 6 },
        });
      }),
      (function (a) {
        a(tb);
      })(function (a) {
        var b = {
            1: "à¼¡",
            2: "à¼¢",
            3: "à¼£",
            4: "à¼¤",
            5: "à¼¥",
            6: "à¼¦",
            7: "à¼§",
            8: "à¼¨",
            9: "à¼©",
            0: "à¼ ",
          },
          c = {
            "à¼¡": "1",
            "à¼¢": "2",
            "à¼£": "3",
            "à¼¤": "4",
            "à¼¥": "5",
            "à¼¦": "6",
            "à¼§": "7",
            "à¼¨": "8",
            "à¼©": "9",
            "à¼ ": "0",
          };
        return a.defineLocale("bo", {
          months:
            "à½Ÿà¾³à¼‹à½–à¼‹à½‘à½„à¼‹à½”à½¼_à½Ÿà¾³à¼‹à½–à¼‹à½‚à½‰à½²à½¦à¼‹à½”_à½Ÿà¾³à¼‹à½–à¼‹à½‚à½¦à½´à½˜à¼‹à½”_à½Ÿà¾³à¼‹à½–à¼‹à½–à½žà½²à¼‹à½”_à½Ÿà¾³à¼‹à½–à¼‹à½£à¾”à¼‹à½”_à½Ÿà¾³à¼‹à½–à¼‹à½‘à¾²à½´à½‚à¼‹à½”_à½Ÿà¾³à¼‹à½–à¼‹à½–à½‘à½´à½“à¼‹à½”_à½Ÿà¾³à¼‹à½–à¼‹à½–à½¢à¾’à¾±à½‘à¼‹à½”_à½Ÿà¾³à¼‹à½–à¼‹à½‘à½‚à½´à¼‹à½”_à½Ÿà¾³à¼‹à½–à¼‹à½–à½…à½´à¼‹à½”_à½Ÿà¾³à¼‹à½–à¼‹à½–à½…à½´à¼‹à½‚à½…à½²à½‚à¼‹à½”_à½Ÿà¾³à¼‹à½–à¼‹à½–à½…à½´à¼‹à½‚à½‰à½²à½¦à¼‹à½”".split(
              "_"
            ),
          monthsShort:
            "à½Ÿà¾³à¼‹à½–à¼‹à½‘à½„à¼‹à½”à½¼_à½Ÿà¾³à¼‹à½–à¼‹à½‚à½‰à½²à½¦à¼‹à½”_à½Ÿà¾³à¼‹à½–à¼‹à½‚à½¦à½´à½˜à¼‹à½”_à½Ÿà¾³à¼‹à½–à¼‹à½–à½žà½²à¼‹à½”_à½Ÿà¾³à¼‹à½–à¼‹à½£à¾”à¼‹à½”_à½Ÿà¾³à¼‹à½–à¼‹à½‘à¾²à½´à½‚à¼‹à½”_à½Ÿà¾³à¼‹à½–à¼‹à½–à½‘à½´à½“à¼‹à½”_à½Ÿà¾³à¼‹à½–à¼‹à½–à½¢à¾’à¾±à½‘à¼‹à½”_à½Ÿà¾³à¼‹à½–à¼‹à½‘à½‚à½´à¼‹à½”_à½Ÿà¾³à¼‹à½–à¼‹à½–à½…à½´à¼‹à½”_à½Ÿà¾³à¼‹à½–à¼‹à½–à½…à½´à¼‹à½‚à½…à½²à½‚à¼‹à½”_à½Ÿà¾³à¼‹à½–à¼‹à½–à½…à½´à¼‹à½‚à½‰à½²à½¦à¼‹à½”".split(
              "_"
            ),
          weekdays:
            "à½‚à½Ÿà½ à¼‹à½‰à½²à¼‹à½˜à¼‹_à½‚à½Ÿà½ à¼‹à½Ÿà¾³à¼‹à½–à¼‹_à½‚à½Ÿà½ à¼‹à½˜à½²à½‚à¼‹à½‘à½˜à½¢à¼‹_à½‚à½Ÿà½ à¼‹à½£à¾·à½‚à¼‹à½”à¼‹_à½‚à½Ÿà½ à¼‹à½•à½´à½¢à¼‹à½–à½´_à½‚à½Ÿà½ à¼‹à½”à¼‹à½¦à½„à½¦à¼‹_à½‚à½Ÿà½ à¼‹à½¦à¾¤à½ºà½“à¼‹à½”à¼‹".split(
              "_"
            ),
          weekdaysShort:
            "à½‰à½²à¼‹à½˜à¼‹_à½Ÿà¾³à¼‹à½–à¼‹_à½˜à½²à½‚à¼‹à½‘à½˜à½¢à¼‹_à½£à¾·à½‚à¼‹à½”à¼‹_à½•à½´à½¢à¼‹à½–à½´_à½”à¼‹à½¦à½„à½¦à¼‹_à½¦à¾¤à½ºà½“à¼‹à½”à¼‹".split(
              "_"
            ),
          weekdaysMin:
            "à½‰à½²à¼‹à½˜à¼‹_à½Ÿà¾³à¼‹à½–à¼‹_à½˜à½²à½‚à¼‹à½‘à½˜à½¢à¼‹_à½£à¾·à½‚à¼‹à½”à¼‹_à½•à½´à½¢à¼‹à½–à½´_à½”à¼‹à½¦à½„à½¦à¼‹_à½¦à¾¤à½ºà½“à¼‹à½”à¼‹".split(
              "_"
            ),
          longDateFormat: {
            LT: "A h:mm",
            L: "DD/MM/YYYY",
            LL: "D MMMM YYYY",
            LLL: "D MMMM YYYY, LT",
            LLLL: "dddd, D MMMM YYYY, LT",
          },
          calendar: {
            sameDay: "[à½‘à½²à¼‹à½¢à½²à½„] LT",
            nextDay: "[à½¦à½„à¼‹à½‰à½²à½“] LT",
            nextWeek: "[à½–à½‘à½´à½“à¼‹à½•à¾²à½‚à¼‹à½¢à¾—à½ºà½¦à¼‹à½˜], LT",
            lastDay: "[à½à¼‹à½¦à½„] LT",
            lastWeek: "[à½–à½‘à½´à½“à¼‹à½•à¾²à½‚à¼‹à½˜à½à½ à¼‹à½˜] dddd, LT",
            sameElse: "L",
          },
          relativeTime: {
            future: "%s à½£à¼‹",
            past: "%s à½¦à¾”à½“à¼‹à½£",
            s: "à½£à½˜à¼‹à½¦à½„",
            m: "à½¦à¾à½¢à¼‹à½˜à¼‹à½‚à½…à½²à½‚",
            mm: "%d à½¦à¾à½¢à¼‹à½˜",
            h: "à½†à½´à¼‹à½šà½¼à½‘à¼‹à½‚à½…à½²à½‚",
            hh: "%d à½†à½´à¼‹à½šà½¼à½‘",
            d: "à½‰à½²à½“à¼‹à½‚à½…à½²à½‚",
            dd: "%d à½‰à½²à½“à¼‹",
            M: "à½Ÿà¾³à¼‹à½–à¼‹à½‚à½…à½²à½‚",
            MM: "%d à½Ÿà¾³à¼‹à½–",
            y: "à½£à½¼à¼‹à½‚à½…à½²à½‚",
            yy: "%d à½£à½¼",
          },
          preparse: function (a) {
            return a.replace(/[à¼¡à¼¢à¼£à¼¤à¼¥à¼¦à¼§à¼¨à¼©à¼ ]/g, function (a) {
              return c[a];
            });
          },
          postformat: function (a) {
            return a.replace(/\d/g, function (a) {
              return b[a];
            });
          },
          meridiem: function (a) {
            return 4 > a
              ? "à½˜à½šà½“à¼‹à½˜à½¼"
              : 10 > a
              ? "à½žà½¼à½‚à½¦à¼‹à½€à½¦"
              : 17 > a
              ? "à½‰à½²à½“à¼‹à½‚à½´à½„"
              : 20 > a
              ? "à½‘à½‚à½¼à½„à¼‹à½‘à½‚"
              : "à½˜à½šà½“à¼‹à½˜à½¼";
          },
          week: { dow: 0, doy: 6 },
        });
      }),
      (function (a) {
        a(tb);
      })(function (b) {
        function c(a, b, c) {
          var d = { mm: "munutenn", MM: "miz", dd: "devezh" };
          return a + " " + f(d[c], a);
        }
        function d(a) {
          switch (e(a)) {
            case 1:
            case 3:
            case 4:
            case 5:
            case 9:
              return a + " bloaz";
            default:
              return a + " vloaz";
          }
        }
        function e(a) {
          return a > 9 ? e(a % 10) : a;
        }
        function f(a, b) {
          return 2 === b ? g(a) : a;
        }
        function g(b) {
          var c = { m: "v", b: "v", d: "z" };
          return c[b.charAt(0)] === a ? b : c[b.charAt(0)] + b.substring(1);
        }
        return b.defineLocale("br", {
          months:
            "Genver_C'hwevrer_Meurzh_Ebrel_Mae_Mezheven_Gouere_Eost_Gwengolo_Here_Du_Kerzu".split(
              "_"
            ),
          monthsShort: "Gen_C'hwe_Meu_Ebr_Mae_Eve_Gou_Eos_Gwe_Her_Du_Ker".split(
            "_"
          ),
          weekdays: "Sul_Lun_Meurzh_Merc'her_Yaou_Gwener_Sadorn".split("_"),
          weekdaysShort: "Sul_Lun_Meu_Mer_Yao_Gwe_Sad".split("_"),
          weekdaysMin: "Su_Lu_Me_Mer_Ya_Gw_Sa".split("_"),
          longDateFormat: {
            LT: "h[e]mm A",
            L: "DD/MM/YYYY",
            LL: "D [a viz] MMMM YYYY",
            LLL: "D [a viz] MMMM YYYY LT",
            LLLL: "dddd, D [a viz] MMMM YYYY LT",
          },
          calendar: {
            sameDay: "[Hiziv da] LT",
            nextDay: "[Warc'hoazh da] LT",
            nextWeek: "dddd [da] LT",
            lastDay: "[Dec'h da] LT",
            lastWeek: "dddd [paset da] LT",
            sameElse: "L",
          },
          relativeTime: {
            future: "a-benn %s",
            past: "%s 'zo",
            s: "un nebeud segondennoÃ¹",
            m: "ur vunutenn",
            mm: c,
            h: "un eur",
            hh: "%d eur",
            d: "un devezh",
            dd: c,
            M: "ur miz",
            MM: c,
            y: "ur bloaz",
            yy: d,
          },
          ordinal: function (a) {
            var b = 1 === a ? "aÃ±" : "vet";
            return a + b;
          },
          week: { dow: 1, doy: 4 },
        });
      }),
      (function (a) {
        a(tb);
      })(function (a) {
        function b(a, b, c) {
          var d = a + " ";
          switch (c) {
            case "m":
              return b ? "jedna minuta" : "jedne minute";
            case "mm":
              return (d +=
                1 === a
                  ? "minuta"
                  : 2 === a || 3 === a || 4 === a
                  ? "minute"
                  : "minuta");
            case "h":
              return b ? "jedan sat" : "jednog sata";
            case "hh":
              return (d +=
                1 === a
                  ? "sat"
                  : 2 === a || 3 === a || 4 === a
                  ? "sata"
                  : "sati");
            case "dd":
              return (d += 1 === a ? "dan" : "dana");
            case "MM":
              return (d +=
                1 === a
                  ? "mjesec"
                  : 2 === a || 3 === a || 4 === a
                  ? "mjeseca"
                  : "mjeseci");
            case "yy":
              return (d +=
                1 === a
                  ? "godina"
                  : 2 === a || 3 === a || 4 === a
                  ? "godine"
                  : "godina");
          }
        }
        return a.defineLocale("bs", {
          months:
            "januar_februar_mart_april_maj_juni_juli_avgust_septembar_oktobar_novembar_decembar".split(
              "_"
            ),
          monthsShort:
            "jan._feb._mar._apr._maj._jun._jul._avg._sep._okt._nov._dec.".split(
              "_"
            ),
          weekdays:
            "nedjelja_ponedjeljak_utorak_srijeda_Äetvrtak_petak_subota".split(
              "_"
            ),
          weekdaysShort: "ned._pon._uto._sri._Äet._pet._sub.".split("_"),
          weekdaysMin: "ne_po_ut_sr_Äe_pe_su".split("_"),
          longDateFormat: {
            LT: "H:mm",
            L: "DD. MM. YYYY",
            LL: "D. MMMM YYYY",
            LLL: "D. MMMM YYYY LT",
            LLLL: "dddd, D. MMMM YYYY LT",
          },
          calendar: {
            sameDay: "[danas u] LT",
            nextDay: "[sutra u] LT",
            nextWeek: function () {
              switch (this.day()) {
                case 0:
                  return "[u] [nedjelju] [u] LT";
                case 3:
                  return "[u] [srijedu] [u] LT";
                case 6:
                  return "[u] [subotu] [u] LT";
                case 1:
                case 2:
                case 4:
                case 5:
                  return "[u] dddd [u] LT";
              }
            },
            lastDay: "[juÄer u] LT",
            lastWeek: function () {
              switch (this.day()) {
                case 0:
                case 3:
                  return "[proÅ¡lu] dddd [u] LT";
                case 6:
                  return "[proÅ¡le] [subote] [u] LT";
                case 1:
                case 2:
                case 4:
                case 5:
                  return "[proÅ¡li] dddd [u] LT";
              }
            },
            sameElse: "L",
          },
          relativeTime: {
            future: "za %s",
            past: "prije %s",
            s: "par sekundi",
            m: b,
            mm: b,
            h: b,
            hh: b,
            d: "dan",
            dd: b,
            M: "mjesec",
            MM: b,
            y: "godinu",
            yy: b,
          },
          ordinal: "%d.",
          week: { dow: 1, doy: 7 },
        });
      }),
      (function (a) {
        a(tb);
      })(function (a) {
        return a.defineLocale("ca", {
          months:
            "gener_febrer_marÃ§_abril_maig_juny_juliol_agost_setembre_octubre_novembre_desembre".split(
              "_"
            ),
          monthsShort:
            "gen._febr._mar._abr._mai._jun._jul._ag._set._oct._nov._des.".split(
              "_"
            ),
          weekdays:
            "diumenge_dilluns_dimarts_dimecres_dijous_divendres_dissabte".split(
              "_"
            ),
          weekdaysShort: "dg._dl._dt._dc._dj._dv._ds.".split("_"),
          weekdaysMin: "Dg_Dl_Dt_Dc_Dj_Dv_Ds".split("_"),
          longDateFormat: {
            LT: "H:mm",
            L: "DD/MM/YYYY",
            LL: "D MMMM YYYY",
            LLL: "D MMMM YYYY LT",
            LLLL: "dddd D MMMM YYYY LT",
          },
          calendar: {
            sameDay: function () {
              return "[avui a " + (1 !== this.hours() ? "les" : "la") + "] LT";
            },
            nextDay: function () {
              return "[demÃ  a " + (1 !== this.hours() ? "les" : "la") + "] LT";
            },
            nextWeek: function () {
              return "dddd [a " + (1 !== this.hours() ? "les" : "la") + "] LT";
            },
            lastDay: function () {
              return "[ahir a " + (1 !== this.hours() ? "les" : "la") + "] LT";
            },
            lastWeek: function () {
              return (
                "[el] dddd [passat a " +
                (1 !== this.hours() ? "les" : "la") +
                "] LT"
              );
            },
            sameElse: "L",
          },
          relativeTime: {
            future: "en %s",
            past: "fa %s",
            s: "uns segons",
            m: "un minut",
            mm: "%d minuts",
            h: "una hora",
            hh: "%d hores",
            d: "un dia",
            dd: "%d dies",
            M: "un mes",
            MM: "%d mesos",
            y: "un any",
            yy: "%d anys",
          },
          ordinal: "%dÂº",
          week: { dow: 1, doy: 4 },
        });
      }),
      (function (a) {
        a(tb);
      })(function (a) {
        function b(a) {
          return a > 1 && 5 > a && 1 !== ~~(a / 10);
        }
        function c(a, c, d, e) {
          var f = a + " ";
          switch (d) {
            case "s":
              return c || e ? "pÃ¡r sekund" : "pÃ¡r sekundami";
            case "m":
              return c ? "minuta" : e ? "minutu" : "minutou";
            case "mm":
              return c || e ? f + (b(a) ? "minuty" : "minut") : f + "minutami";
              break;
            case "h":
              return c ? "hodina" : e ? "hodinu" : "hodinou";
            case "hh":
              return c || e ? f + (b(a) ? "hodiny" : "hodin") : f + "hodinami";
              break;
            case "d":
              return c || e ? "den" : "dnem";
            case "dd":
              return c || e ? f + (b(a) ? "dny" : "dnÃ­") : f + "dny";
              break;
            case "M":
              return c || e ? "mÄ›sÃ­c" : "mÄ›sÃ­cem";
            case "MM":
              return c || e
                ? f + (b(a) ? "mÄ›sÃ­ce" : "mÄ›sÃ­cÅ¯")
                : f + "mÄ›sÃ­ci";
              break;
            case "y":
              return c || e ? "rok" : "rokem";
            case "yy":
              return c || e ? f + (b(a) ? "roky" : "let") : f + "lety";
          }
        }
        var d =
            "leden_Ãºnor_bÅ™ezen_duben_kvÄ›ten_Äerven_Äervenec_srpen_zÃ¡Å™Ã­_Å™Ã­jen_listopad_prosinec".split(
              "_"
            ),
          e = "led_Ãºno_bÅ™e_dub_kvÄ›_Ävn_Ävc_srp_zÃ¡Å™_Å™Ã­j_lis_pro".split(
            "_"
          );
        return a.defineLocale("cs", {
          months: d,
          monthsShort: e,
          monthsParse: (function (a, b) {
            var c,
              d = [];
            for (c = 0; 12 > c; c++)
              d[c] = new RegExp("^" + a[c] + "$|^" + b[c] + "$", "i");
            return d;
          })(d, e),
          weekdays:
            "nedÄ›le_pondÄ›lÃ­_ÃºterÃ½_stÅ™eda_Ätvrtek_pÃ¡tek_sobota".split(
              "_"
            ),
          weekdaysShort: "ne_po_Ãºt_st_Ät_pÃ¡_so".split("_"),
          weekdaysMin: "ne_po_Ãºt_st_Ät_pÃ¡_so".split("_"),
          longDateFormat: {
            LT: "H:mm",
            L: "DD.Â MM.Â YYYY",
            LL: "D. MMMM YYYY",
            LLL: "D. MMMM YYYY LT",
            LLLL: "dddd D. MMMM YYYY LT",
          },
          calendar: {
            sameDay: "[dnes v] LT",
            nextDay: "[zÃ­tra v] LT",
            nextWeek: function () {
              switch (this.day()) {
                case 0:
                  return "[v nedÄ›li v] LT";
                case 1:
                case 2:
                  return "[v] dddd [v] LT";
                case 3:
                  return "[ve stÅ™edu v] LT";
                case 4:
                  return "[ve Ätvrtek v] LT";
                case 5:
                  return "[v pÃ¡tek v] LT";
                case 6:
                  return "[v sobotu v] LT";
              }
            },
            lastDay: "[vÄera v] LT",
            lastWeek: function () {
              switch (this.day()) {
                case 0:
                  return "[minulou nedÄ›li v] LT";
                case 1:
                case 2:
                  return "[minulÃ©] dddd [v] LT";
                case 3:
                  return "[minulou stÅ™edu v] LT";
                case 4:
                case 5:
                  return "[minulÃ½] dddd [v] LT";
                case 6:
                  return "[minulou sobotu v] LT";
              }
            },
            sameElse: "L",
          },
          relativeTime: {
            future: "za %s",
            past: "pÅ™ed %s",
            s: c,
            m: c,
            mm: c,
            h: c,
            hh: c,
            d: c,
            dd: c,
            M: c,
            MM: c,
            y: c,
            yy: c,
          },
          ordinal: "%d.",
          week: { dow: 1, doy: 4 },
        });
      }),
      (function (a) {
        a(tb);
      })(function (a) {
        return a.defineLocale("cv", {
          months:
            "ÐºÄƒÑ€Ð»Ð°Ñ‡_Ð½Ð°Ñ€ÄƒÑ_Ð¿ÑƒÑˆ_Ð°ÐºÐ°_Ð¼Ð°Ð¹_Ã§Ä•Ñ€Ñ‚Ð¼Ðµ_ÑƒÑ‚Äƒ_Ã§ÑƒÑ€Ð»Ð°_Ð°Ð²ÄƒÐ½_ÑŽÐ¿Ð°_Ñ‡Ó³Ðº_Ñ€Ð°ÑˆÑ‚Ð°Ð²".split(
              "_"
            ),
          monthsShort:
            "ÐºÄƒÑ€_Ð½Ð°Ñ€_Ð¿ÑƒÑˆ_Ð°ÐºÐ°_Ð¼Ð°Ð¹_Ã§Ä•Ñ€_ÑƒÑ‚Äƒ_Ã§ÑƒÑ€_Ð°Ð²_ÑŽÐ¿Ð°_Ñ‡Ó³Ðº_Ñ€Ð°Ñˆ".split(
              "_"
            ),
          weekdays:
            "Ð²Ñ‹Ñ€ÑÐ°Ñ€Ð½Ð¸ÐºÑƒÐ½_Ñ‚ÑƒÐ½Ñ‚Ð¸ÐºÑƒÐ½_Ñ‹Ñ‚Ð»Ð°Ñ€Ð¸ÐºÑƒÐ½_ÑŽÐ½ÐºÑƒÐ½_ÐºÄ•Ã§Ð½ÐµÑ€Ð½Ð¸ÐºÑƒÐ½_ÑÑ€Ð½ÐµÐºÑƒÐ½_ÑˆÄƒÐ¼Ð°Ñ‚ÐºÑƒÐ½".split(
              "_"
            ),
          weekdaysShort: "Ð²Ñ‹Ñ€_Ñ‚ÑƒÐ½_Ñ‹Ñ‚Ð»_ÑŽÐ½_ÐºÄ•Ã§_ÑÑ€Ð½_ÑˆÄƒÐ¼".split(
            "_"
          ),
          weekdaysMin: "Ð²Ñ€_Ñ‚Ð½_Ñ‹Ñ‚_ÑŽÐ½_ÐºÃ§_ÑÑ€_ÑˆÐ¼".split("_"),
          longDateFormat: {
            LT: "HH:mm",
            L: "DD-MM-YYYY",
            LL: "YYYY [Ã§ÑƒÐ»Ñ…Ð¸] MMMM [ÑƒÐ¹ÄƒÑ…Ä•Ð½] D[-Ð¼Ä•ÑˆÄ•]",
            LLL: "YYYY [Ã§ÑƒÐ»Ñ…Ð¸] MMMM [ÑƒÐ¹ÄƒÑ…Ä•Ð½] D[-Ð¼Ä•ÑˆÄ•], LT",
            LLLL: "dddd, YYYY [Ã§ÑƒÐ»Ñ…Ð¸] MMMM [ÑƒÐ¹ÄƒÑ…Ä•Ð½] D[-Ð¼Ä•ÑˆÄ•], LT",
          },
          calendar: {
            sameDay: "[ÐŸÐ°ÑÐ½] LT [ÑÐµÑ…ÐµÑ‚Ñ€Ðµ]",
            nextDay: "[Ð«Ñ€Ð°Ð½] LT [ÑÐµÑ…ÐµÑ‚Ñ€Ðµ]",
            lastDay: "[Ä”Ð½ÐµÑ€] LT [ÑÐµÑ…ÐµÑ‚Ñ€Ðµ]",
            nextWeek: "[Ã‡Ð¸Ñ‚ÐµÑ] dddd LT [ÑÐµÑ…ÐµÑ‚Ñ€Ðµ]",
            lastWeek: "[Ð˜Ñ€Ñ‚Ð½Ä•] dddd LT [ÑÐµÑ…ÐµÑ‚Ñ€Ðµ]",
            sameElse: "L",
          },
          relativeTime: {
            future: function (a) {
              var b = /ÑÐµÑ…ÐµÑ‚$/i.exec(a)
                ? "Ñ€ÐµÐ½"
                : /Ã§ÑƒÐ»$/i.exec(a)
                ? "Ñ‚Ð°Ð½"
                : "Ñ€Ð°Ð½";
              return a + b;
            },
            past: "%s ÐºÐ°ÑÐ»Ð»Ð°",
            s: "Ð¿Ä•Ñ€-Ð¸Ðº Ã§ÐµÐºÐºÑƒÐ½Ñ‚",
            m: "Ð¿Ä•Ñ€ Ð¼Ð¸Ð½ÑƒÑ‚",
            mm: "%d Ð¼Ð¸Ð½ÑƒÑ‚",
            h: "Ð¿Ä•Ñ€ ÑÐµÑ…ÐµÑ‚",
            hh: "%d ÑÐµÑ…ÐµÑ‚",
            d: "Ð¿Ä•Ñ€ ÐºÑƒÐ½",
            dd: "%d ÐºÑƒÐ½",
            M: "Ð¿Ä•Ñ€ ÑƒÐ¹ÄƒÑ…",
            MM: "%d ÑƒÐ¹ÄƒÑ…",
            y: "Ð¿Ä•Ñ€ Ã§ÑƒÐ»",
            yy: "%d Ã§ÑƒÐ»",
          },
          ordinal: "%d-Ð¼Ä•Ñˆ",
          week: { dow: 1, doy: 7 },
        });
      }),
      (function (a) {
        a(tb);
      })(function (a) {
        return a.defineLocale("cy", {
          months:
            "Ionawr_Chwefror_Mawrth_Ebrill_Mai_Mehefin_Gorffennaf_Awst_Medi_Hydref_Tachwedd_Rhagfyr".split(
              "_"
            ),
          monthsShort:
            "Ion_Chwe_Maw_Ebr_Mai_Meh_Gor_Aws_Med_Hyd_Tach_Rhag".split("_"),
          weekdays:
            "Dydd Sul_Dydd Llun_Dydd Mawrth_Dydd Mercher_Dydd Iau_Dydd Gwener_Dydd Sadwrn".split(
              "_"
            ),
          weekdaysShort: "Sul_Llun_Maw_Mer_Iau_Gwe_Sad".split("_"),
          weekdaysMin: "Su_Ll_Ma_Me_Ia_Gw_Sa".split("_"),
          longDateFormat: {
            LT: "HH:mm",
            L: "DD/MM/YYYY",
            LL: "D MMMM YYYY",
            LLL: "D MMMM YYYY LT",
            LLLL: "dddd, D MMMM YYYY LT",
          },
          calendar: {
            sameDay: "[Heddiw am] LT",
            nextDay: "[Yfory am] LT",
            nextWeek: "dddd [am] LT",
            lastDay: "[Ddoe am] LT",
            lastWeek: "dddd [diwethaf am] LT",
            sameElse: "L",
          },
          relativeTime: {
            future: "mewn %s",
            past: "%s yn Ã´l",
            s: "ychydig eiliadau",
            m: "munud",
            mm: "%d munud",
            h: "awr",
            hh: "%d awr",
            d: "diwrnod",
            dd: "%d diwrnod",
            M: "mis",
            MM: "%d mis",
            y: "blwyddyn",
            yy: "%d flynedd",
          },
          ordinal: function (a) {
            var b = a,
              c = "",
              d = [
                "",
                "af",
                "il",
                "ydd",
                "ydd",
                "ed",
                "ed",
                "ed",
                "fed",
                "fed",
                "fed",
                "eg",
                "fed",
                "eg",
                "eg",
                "fed",
                "eg",
                "eg",
                "fed",
                "eg",
                "fed",
              ];
            return (
              b > 20
                ? (c =
                    40 === b || 50 === b || 60 === b || 80 === b || 100 === b
                      ? "fed"
                      : "ain")
                : b > 0 && (c = d[b]),
              a + c
            );
          },
          week: { dow: 1, doy: 4 },
        });
      }),
      (function (a) {
        a(tb);
      })(function (a) {
        return a.defineLocale("da", {
          months:
            "januar_februar_marts_april_maj_juni_juli_august_september_oktober_november_december".split(
              "_"
            ),
          monthsShort: "jan_feb_mar_apr_maj_jun_jul_aug_sep_okt_nov_dec".split(
            "_"
          ),
          weekdays:
            "sÃ¸ndag_mandag_tirsdag_onsdag_torsdag_fredag_lÃ¸rdag".split("_"),
          weekdaysShort: "sÃ¸n_man_tir_ons_tor_fre_lÃ¸r".split("_"),
          weekdaysMin: "sÃ¸_ma_ti_on_to_fr_lÃ¸".split("_"),
          longDateFormat: {
            LT: "HH:mm",
            L: "DD/MM/YYYY",
            LL: "D. MMMM YYYY",
            LLL: "D. MMMM YYYY LT",
            LLLL: "dddd [d.] D. MMMM YYYY LT",
          },
          calendar: {
            sameDay: "[I dag kl.] LT",
            nextDay: "[I morgen kl.] LT",
            nextWeek: "dddd [kl.] LT",
            lastDay: "[I gÃ¥r kl.] LT",
            lastWeek: "[sidste] dddd [kl] LT",
            sameElse: "L",
          },
          relativeTime: {
            future: "om %s",
            past: "%s siden",
            s: "fÃ¥ sekunder",
            m: "et minut",
            mm: "%d minutter",
            h: "en time",
            hh: "%d timer",
            d: "en dag",
            dd: "%d dage",
            M: "en mÃ¥ned",
            MM: "%d mÃ¥neder",
            y: "et Ã¥r",
            yy: "%d Ã¥r",
          },
          ordinal: "%d.",
          week: { dow: 1, doy: 4 },
        });
      }),
      (function (a) {
        a(tb);
      })(function (a) {
        function b(a, b, c) {
          var d = {
            m: ["eine Minute", "einer Minute"],
            h: ["eine Stunde", "einer Stunde"],
            d: ["ein Tag", "einem Tag"],
            dd: [a + " Tage", a + " Tagen"],
            M: ["ein Monat", "einem Monat"],
            MM: [a + " Monate", a + " Monaten"],
            y: ["ein Jahr", "einem Jahr"],
            yy: [a + " Jahre", a + " Jahren"],
          };
          return b ? d[c][0] : d[c][1];
        }
        return a.defineLocale("de-at", {
          months:
            "JÃ¤nner_Februar_MÃ¤rz_April_Mai_Juni_Juli_August_September_Oktober_November_Dezember".split(
              "_"
            ),
          monthsShort:
            "JÃ¤n._Febr._Mrz._Apr._Mai_Jun._Jul._Aug._Sept._Okt._Nov._Dez.".split(
              "_"
            ),
          weekdays:
            "Sonntag_Montag_Dienstag_Mittwoch_Donnerstag_Freitag_Samstag".split(
              "_"
            ),
          weekdaysShort: "So._Mo._Di._Mi._Do._Fr._Sa.".split("_"),
          weekdaysMin: "So_Mo_Di_Mi_Do_Fr_Sa".split("_"),
          longDateFormat: {
            LT: "HH:mm [Uhr]",
            L: "DD.MM.YYYY",
            LL: "D. MMMM YYYY",
            LLL: "D. MMMM YYYY LT",
            LLLL: "dddd, D. MMMM YYYY LT",
          },
          calendar: {
            sameDay: "[Heute um] LT",
            sameElse: "L",
            nextDay: "[Morgen um] LT",
            nextWeek: "dddd [um] LT",
            lastDay: "[Gestern um] LT",
            lastWeek: "[letzten] dddd [um] LT",
          },
          relativeTime: {
            future: "in %s",
            past: "vor %s",
            s: "ein paar Sekunden",
            m: b,
            mm: "%d Minuten",
            h: b,
            hh: "%d Stunden",
            d: b,
            dd: b,
            M: b,
            MM: b,
            y: b,
            yy: b,
          },
          ordinal: "%d.",
          week: { dow: 1, doy: 4 },
        });
      }),
      (function (a) {
        a(tb);
      })(function (a) {
        function b(a, b, c) {
          var d = {
            m: ["eine Minute", "einer Minute"],
            h: ["eine Stunde", "einer Stunde"],
            d: ["ein Tag", "einem Tag"],
            dd: [a + " Tage", a + " Tagen"],
            M: ["ein Monat", "einem Monat"],
            MM: [a + " Monate", a + " Monaten"],
            y: ["ein Jahr", "einem Jahr"],
            yy: [a + " Jahre", a + " Jahren"],
          };
          return b ? d[c][0] : d[c][1];
        }
        return a.defineLocale("de", {
          months:
            "Januar_Februar_MÃ¤rz_April_Mai_Juni_Juli_August_September_Oktober_November_Dezember".split(
              "_"
            ),
          monthsShort:
            "Jan._Febr._Mrz._Apr._Mai_Jun._Jul._Aug._Sept._Okt._Nov._Dez.".split(
              "_"
            ),
          weekdays:
            "Sonntag_Montag_Dienstag_Mittwoch_Donnerstag_Freitag_Samstag".split(
              "_"
            ),
          weekdaysShort: "So._Mo._Di._Mi._Do._Fr._Sa.".split("_"),
          weekdaysMin: "So_Mo_Di_Mi_Do_Fr_Sa".split("_"),
          longDateFormat: {
            LT: "HH:mm [Uhr]",
            L: "DD.MM.YYYY",
            LL: "D. MMMM YYYY",
            LLL: "D. MMMM YYYY LT",
            LLLL: "dddd, D. MMMM YYYY LT",
          },
          calendar: {
            sameDay: "[Heute um] LT",
            sameElse: "L",
            nextDay: "[Morgen um] LT",
            nextWeek: "dddd [um] LT",
            lastDay: "[Gestern um] LT",
            lastWeek: "[letzten] dddd [um] LT",
          },
          relativeTime: {
            future: "in %s",
            past: "vor %s",
            s: "ein paar Sekunden",
            m: b,
            mm: "%d Minuten",
            h: b,
            hh: "%d Stunden",
            d: b,
            dd: b,
            M: b,
            MM: b,
            y: b,
            yy: b,
          },
          ordinal: "%d.",
          week: { dow: 1, doy: 4 },
        });
      }),
      (function (a) {
        a(tb);
      })(function (a) {
        return a.defineLocale("el", {
          monthsNominativeEl:
            "Î™Î±Î½Î¿Ï…Î¬ÏÎ¹Î¿Ï‚_Î¦ÎµÎ²ÏÎ¿Ï…Î¬ÏÎ¹Î¿Ï‚_ÎœÎ¬ÏÏ„Î¹Î¿Ï‚_Î‘Ï€ÏÎ¯Î»Î¹Î¿Ï‚_ÎœÎ¬Î¹Î¿Ï‚_Î™Î¿ÏÎ½Î¹Î¿Ï‚_Î™Î¿ÏÎ»Î¹Î¿Ï‚_Î‘ÏÎ³Î¿Ï…ÏƒÏ„Î¿Ï‚_Î£ÎµÏ€Ï„Î­Î¼Î²ÏÎ¹Î¿Ï‚_ÎŸÎºÏ„ÏŽÎ²ÏÎ¹Î¿Ï‚_ÎÎ¿Î­Î¼Î²ÏÎ¹Î¿Ï‚_Î”ÎµÎºÎ­Î¼Î²ÏÎ¹Î¿Ï‚".split(
              "_"
            ),
          monthsGenitiveEl:
            "Î™Î±Î½Î¿Ï…Î±ÏÎ¯Î¿Ï…_Î¦ÎµÎ²ÏÎ¿Ï…Î±ÏÎ¯Î¿Ï…_ÎœÎ±ÏÏ„Î¯Î¿Ï…_Î‘Ï€ÏÎ¹Î»Î¯Î¿Ï…_ÎœÎ±ÎÎ¿Ï…_Î™Î¿Ï…Î½Î¯Î¿Ï…_Î™Î¿Ï…Î»Î¯Î¿Ï…_Î‘Ï…Î³Î¿ÏÏƒÏ„Î¿Ï…_Î£ÎµÏ€Ï„ÎµÎ¼Î²ÏÎ¯Î¿Ï…_ÎŸÎºÏ„Ï‰Î²ÏÎ¯Î¿Ï…_ÎÎ¿ÎµÎ¼Î²ÏÎ¯Î¿Ï…_Î”ÎµÎºÎµÎ¼Î²ÏÎ¯Î¿Ï…".split(
              "_"
            ),
          months: function (a, b) {
            return /D/.test(b.substring(0, b.indexOf("MMMM")))
              ? this._monthsGenitiveEl[a.month()]
              : this._monthsNominativeEl[a.month()];
          },
          monthsShort:
            "Î™Î±Î½_Î¦ÎµÎ²_ÎœÎ±Ï_Î‘Ï€Ï_ÎœÎ±ÏŠ_Î™Î¿Ï…Î½_Î™Î¿Ï…Î»_Î‘Ï…Î³_Î£ÎµÏ€_ÎŸÎºÏ„_ÎÎ¿Îµ_Î”ÎµÎº".split(
              "_"
            ),
          weekdays:
            "ÎšÏ…ÏÎ¹Î±ÎºÎ®_Î”ÎµÏ…Ï„Î­ÏÎ±_Î¤ÏÎ¯Ï„Î·_Î¤ÎµÏ„Î¬ÏÏ„Î·_Î Î­Î¼Ï€Ï„Î·_Î Î±ÏÎ±ÏƒÎºÎµÏ…Î®_Î£Î¬Î²Î²Î±Ï„Î¿".split(
              "_"
            ),
          weekdaysShort: "ÎšÏ…Ï_Î”ÎµÏ…_Î¤ÏÎ¹_Î¤ÎµÏ„_Î ÎµÎ¼_Î Î±Ï_Î£Î±Î²".split(
            "_"
          ),
          weekdaysMin: "ÎšÏ…_Î”Îµ_Î¤Ï_Î¤Îµ_Î Îµ_Î Î±_Î£Î±".split("_"),
          meridiem: function (a, b, c) {
            return a > 11 ? (c ? "Î¼Î¼" : "ÎœÎœ") : c ? "Ï€Î¼" : "Î Îœ";
          },
          isPM: function (a) {
            return "Î¼" === (a + "").toLowerCase()[0];
          },
          meridiemParse: /[Î Îœ]\.?Îœ?\.?/i,
          longDateFormat: {
            LT: "h:mm A",
            L: "DD/MM/YYYY",
            LL: "D MMMM YYYY",
            LLL: "D MMMM YYYY LT",
            LLLL: "dddd, D MMMM YYYY LT",
          },
          calendarEl: {
            sameDay: "[Î£Î®Î¼ÎµÏÎ± {}] LT",
            nextDay: "[Î‘ÏÏÎ¹Î¿ {}] LT",
            nextWeek: "dddd [{}] LT",
            lastDay: "[Î§Î¸ÎµÏ‚ {}] LT",
            lastWeek: function () {
              switch (this.day()) {
                case 6:
                  return "[Ï„Î¿ Ï€ÏÎ¿Î·Î³Î¿ÏÎ¼ÎµÎ½Î¿] dddd [{}] LT";
                default:
                  return "[Ï„Î·Î½ Ï€ÏÎ¿Î·Î³Î¿ÏÎ¼ÎµÎ½Î·] dddd [{}] LT";
              }
            },
            sameElse: "L",
          },
          calendar: function (a, b) {
            var c = this._calendarEl[a],
              d = b && b.hours();
            return (
              "function" == typeof c && (c = c.apply(b)),
              c.replace("{}", d % 12 === 1 ? "ÏƒÏ„Î·" : "ÏƒÏ„Î¹Ï‚")
            );
          },
          relativeTime: {
            future: "ÏƒÎµ %s",
            past: "%s Ï€ÏÎ¹Î½",
            s: "Î´ÎµÏ…Ï„ÎµÏÏŒÎ»ÎµÏ€Ï„Î±",
            m: "Î­Î½Î± Î»ÎµÏ€Ï„ÏŒ",
            mm: "%d Î»ÎµÏ€Ï„Î¬",
            h: "Î¼Î¯Î± ÏŽÏÎ±",
            hh: "%d ÏŽÏÎµÏ‚",
            d: "Î¼Î¯Î± Î¼Î­ÏÎ±",
            dd: "%d Î¼Î­ÏÎµÏ‚",
            M: "Î­Î½Î±Ï‚ Î¼Î®Î½Î±Ï‚",
            MM: "%d Î¼Î®Î½ÎµÏ‚",
            y: "Î­Î½Î±Ï‚ Ï‡ÏÏŒÎ½Î¿Ï‚",
            yy: "%d Ï‡ÏÏŒÎ½Î¹Î±",
          },
          ordinal: function (a) {
            return a + "Î·";
          },
          week: { dow: 1, doy: 4 },
        });
      }),
      (function (a) {
        a(tb);
      })(function (a) {
        return a.defineLocale("en-au", {
          months:
            "January_February_March_April_May_June_July_August_September_October_November_December".split(
              "_"
            ),
          monthsShort: "Jan_Feb_Mar_Apr_May_Jun_Jul_Aug_Sep_Oct_Nov_Dec".split(
            "_"
          ),
          weekdays:
            "Sunday_Monday_Tuesday_Wednesday_Thursday_Friday_Saturday".split(
              "_"
            ),
          weekdaysShort: "Sun_Mon_Tue_Wed_Thu_Fri_Sat".split("_"),
          weekdaysMin: "Su_Mo_Tu_We_Th_Fr_Sa".split("_"),
          longDateFormat: {
            LT: "h:mm A",
            L: "DD/MM/YYYY",
            LL: "D MMMM YYYY",
            LLL: "D MMMM YYYY LT",
            LLLL: "dddd, D MMMM YYYY LT",
          },
          calendar: {
            sameDay: "[Today at] LT",
            nextDay: "[Tomorrow at] LT",
            nextWeek: "dddd [at] LT",
            lastDay: "[Yesterday at] LT",
            lastWeek: "[Last] dddd [at] LT",
            sameElse: "L",
          },
          relativeTime: {
            future: "in %s",
            past: "%s ago",
            s: "a few seconds",
            m: "a minute",
            mm: "%d minutes",
            h: "an hour",
            hh: "%d hours",
            d: "a day",
            dd: "%d days",
            M: "a month",
            MM: "%d months",
            y: "a year",
            yy: "%d years",
          },
          ordinal: function (a) {
            var b = a % 10,
              c =
                1 === ~~((a % 100) / 10)
                  ? "th"
                  : 1 === b
                  ? "st"
                  : 2 === b
                  ? "nd"
                  : 3 === b
                  ? "rd"
                  : "th";
            return a + c;
          },
          week: { dow: 1, doy: 4 },
        });
      }),
      (function (a) {
        a(tb);
      })(function (a) {
        return a.defineLocale("en-ca", {
          months:
            "January_February_March_April_May_June_July_August_September_October_November_December".split(
              "_"
            ),
          monthsShort: "Jan_Feb_Mar_Apr_May_Jun_Jul_Aug_Sep_Oct_Nov_Dec".split(
            "_"
          ),
          weekdays:
            "Sunday_Monday_Tuesday_Wednesday_Thursday_Friday_Saturday".split(
              "_"
            ),
          weekdaysShort: "Sun_Mon_Tue_Wed_Thu_Fri_Sat".split("_"),
          weekdaysMin: "Su_Mo_Tu_We_Th_Fr_Sa".split("_"),
          longDateFormat: {
            LT: "h:mm A",
            L: "YYYY-MM-DD",
            LL: "D MMMM, YYYY",
            LLL: "D MMMM, YYYY LT",
            LLLL: "dddd, D MMMM, YYYY LT",
          },
          calendar: {
            sameDay: "[Today at] LT",
            nextDay: "[Tomorrow at] LT",
            nextWeek: "dddd [at] LT",
            lastDay: "[Yesterday at] LT",
            lastWeek: "[Last] dddd [at] LT",
            sameElse: "L",
          },
          relativeTime: {
            future: "in %s",
            past: "%s ago",
            s: "a few seconds",
            m: "a minute",
            mm: "%d minutes",
            h: "an hour",
            hh: "%d hours",
            d: "a day",
            dd: "%d days",
            M: "a month",
            MM: "%d months",
            y: "a year",
            yy: "%d years",
          },
          ordinal: function (a) {
            var b = a % 10,
              c =
                1 === ~~((a % 100) / 10)
                  ? "th"
                  : 1 === b
                  ? "st"
                  : 2 === b
                  ? "nd"
                  : 3 === b
                  ? "rd"
                  : "th";
            return a + c;
          },
        });
      }),
      (function (a) {
        a(tb);
      })(function (a) {
        return a.defineLocale("en-gb", {
          months:
            "January_February_March_April_May_June_July_August_September_October_November_December".split(
              "_"
            ),
          monthsShort: "Jan_Feb_Mar_Apr_May_Jun_Jul_Aug_Sep_Oct_Nov_Dec".split(
            "_"
          ),
          weekdays:
            "Sunday_Monday_Tuesday_Wednesday_Thursday_Friday_Saturday".split(
              "_"
            ),
          weekdaysShort: "Sun_Mon_Tue_Wed_Thu_Fri_Sat".split("_"),
          weekdaysMin: "Su_Mo_Tu_We_Th_Fr_Sa".split("_"),
          longDateFormat: {
            LT: "HH:mm",
            L: "DD/MM/YYYY",
            LL: "D MMMM YYYY",
            LLL: "D MMMM YYYY LT",
            LLLL: "dddd, D MMMM YYYY LT",
          },
          calendar: {
            sameDay: "[Today at] LT",
            nextDay: "[Tomorrow at] LT",
            nextWeek: "dddd [at] LT",
            lastDay: "[Yesterday at] LT",
            lastWeek: "[Last] dddd [at] LT",
            sameElse: "L",
          },
          relativeTime: {
            future: "in %s",
            past: "%s ago",
            s: "a few seconds",
            m: "a minute",
            mm: "%d minutes",
            h: "an hour",
            hh: "%d hours",
            d: "a day",
            dd: "%d days",
            M: "a month",
            MM: "%d months",
            y: "a year",
            yy: "%d years",
          },
          ordinal: function (a) {
            var b = a % 10,
              c =
                1 === ~~((a % 100) / 10)
                  ? "th"
                  : 1 === b
                  ? "st"
                  : 2 === b
                  ? "nd"
                  : 3 === b
                  ? "rd"
                  : "th";
            return a + c;
          },
          week: { dow: 1, doy: 4 },
        });
      }),
      (function (a) {
        a(tb);
      })(function (a) {
        return a.defineLocale("eo", {
          months:
            "januaro_februaro_marto_aprilo_majo_junio_julio_aÅ­gusto_septembro_oktobro_novembro_decembro".split(
              "_"
            ),
          monthsShort: "jan_feb_mar_apr_maj_jun_jul_aÅ­g_sep_okt_nov_dec".split(
            "_"
          ),
          weekdays:
            "DimanÄ‰o_Lundo_Mardo_Merkredo_Ä´aÅ­do_Vendredo_Sabato".split("_"),
          weekdaysShort: "Dim_Lun_Mard_Merk_Ä´aÅ­_Ven_Sab".split("_"),
          weekdaysMin: "Di_Lu_Ma_Me_Ä´a_Ve_Sa".split("_"),
          longDateFormat: {
            LT: "HH:mm",
            L: "YYYY-MM-DD",
            LL: "D[-an de] MMMM, YYYY",
            LLL: "D[-an de] MMMM, YYYY LT",
            LLLL: "dddd, [la] D[-an de] MMMM, YYYY LT",
          },
          meridiem: function (a, b, c) {
            return a > 11 ? (c ? "p.t.m." : "P.T.M.") : c ? "a.t.m." : "A.T.M.";
          },
          calendar: {
            sameDay: "[HodiaÅ­ je] LT",
            nextDay: "[MorgaÅ­ je] LT",
            nextWeek: "dddd [je] LT",
            lastDay: "[HieraÅ­ je] LT",
            lastWeek: "[pasinta] dddd [je] LT",
            sameElse: "L",
          },
          relativeTime: {
            future: "je %s",
            past: "antaÅ­ %s",
            s: "sekundoj",
            m: "minuto",
            mm: "%d minutoj",
            h: "horo",
            hh: "%d horoj",
            d: "tago",
            dd: "%d tagoj",
            M: "monato",
            MM: "%d monatoj",
            y: "jaro",
            yy: "%d jaroj",
          },
          ordinal: "%da",
          week: { dow: 1, doy: 7 },
        });
      }),
      (function (a) {
        a(tb);
      })(function (a) {
        var b =
            "ene._feb._mar._abr._may._jun._jul._ago._sep._oct._nov._dic.".split(
              "_"
            ),
          c = "ene_feb_mar_abr_may_jun_jul_ago_sep_oct_nov_dic".split("_");
        return a.defineLocale("es", {
          months:
            "enero_febrero_marzo_abril_mayo_junio_julio_agosto_septiembre_octubre_noviembre_diciembre".split(
              "_"
            ),
          monthsShort: function (a, d) {
            return /-MMM-/.test(d) ? c[a.month()] : b[a.month()];
          },
          weekdays:
            "domingo_lunes_martes_miÃ©rcoles_jueves_viernes_sÃ¡bado".split("_"),
          weekdaysShort: "dom._lun._mar._miÃ©._jue._vie._sÃ¡b.".split("_"),
          weekdaysMin: "Do_Lu_Ma_Mi_Ju_Vi_SÃ¡".split("_"),
          longDateFormat: {
            LT: "H:mm",
            L: "DD/MM/YYYY",
            LL: "D [de] MMMM [de] YYYY",
            LLL: "D [de] MMMM [de] YYYY LT",
            LLLL: "dddd, D [de] MMMM [de] YYYY LT",
          },
          calendar: {
            sameDay: function () {
              return "[hoy a la" + (1 !== this.hours() ? "s" : "") + "] LT";
            },
            nextDay: function () {
              return "[maÃ±ana a la" + (1 !== this.hours() ? "s" : "") + "] LT";
            },
            nextWeek: function () {
              return "dddd [a la" + (1 !== this.hours() ? "s" : "") + "] LT";
            },
            lastDay: function () {
              return "[ayer a la" + (1 !== this.hours() ? "s" : "") + "] LT";
            },
            lastWeek: function () {
              return (
                "[el] dddd [pasado a la" +
                (1 !== this.hours() ? "s" : "") +
                "] LT"
              );
            },
            sameElse: "L",
          },
          relativeTime: {
            future: "en %s",
            past: "hace %s",
            s: "unos segundos",
            m: "un minuto",
            mm: "%d minutos",
            h: "una hora",
            hh: "%d horas",
            d: "un dÃ­a",
            dd: "%d dÃ­as",
            M: "un mes",
            MM: "%d meses",
            y: "un aÃ±o",
            yy: "%d aÃ±os",
          },
          ordinal: "%dÂº",
          week: { dow: 1, doy: 4 },
        });
      }),
      (function (a) {
        a(tb);
      })(function (a) {
        function b(a, b, c, d) {
          var e = {
            s: ["mÃµne sekundi", "mÃµni sekund", "paar sekundit"],
            m: ["Ã¼he minuti", "Ã¼ks minut"],
            mm: [a + " minuti", a + " minutit"],
            h: ["Ã¼he tunni", "tund aega", "Ã¼ks tund"],
            hh: [a + " tunni", a + " tundi"],
            d: ["Ã¼he pÃ¤eva", "Ã¼ks pÃ¤ev"],
            M: ["kuu aja", "kuu aega", "Ã¼ks kuu"],
            MM: [a + " kuu", a + " kuud"],
            y: ["Ã¼he aasta", "aasta", "Ã¼ks aasta"],
            yy: [a + " aasta", a + " aastat"],
          };
          return b ? (e[c][2] ? e[c][2] : e[c][1]) : d ? e[c][0] : e[c][1];
        }
        return a.defineLocale("et", {
          months:
            "jaanuar_veebruar_mÃ¤rts_aprill_mai_juuni_juuli_august_september_oktoober_november_detsember".split(
              "_"
            ),
          monthsShort:
            "jaan_veebr_mÃ¤rts_apr_mai_juuni_juuli_aug_sept_okt_nov_dets".split(
              "_"
            ),
          weekdays:
            "pÃ¼hapÃ¤ev_esmaspÃ¤ev_teisipÃ¤ev_kolmapÃ¤ev_neljapÃ¤ev_reede_laupÃ¤ev".split(
              "_"
            ),
          weekdaysShort: "P_E_T_K_N_R_L".split("_"),
          weekdaysMin: "P_E_T_K_N_R_L".split("_"),
          longDateFormat: {
            LT: "H:mm",
            L: "DD.MM.YYYY",
            LL: "D. MMMM YYYY",
            LLL: "D. MMMM YYYY LT",
            LLLL: "dddd, D. MMMM YYYY LT",
          },
          calendar: {
            sameDay: "[TÃ¤na,] LT",
            nextDay: "[Homme,] LT",
            nextWeek: "[JÃ¤rgmine] dddd LT",
            lastDay: "[Eile,] LT",
            lastWeek: "[Eelmine] dddd LT",
            sameElse: "L",
          },
          relativeTime: {
            future: "%s pÃ¤rast",
            past: "%s tagasi",
            s: b,
            m: b,
            mm: b,
            h: b,
            hh: b,
            d: b,
            dd: "%d pÃ¤eva",
            M: b,
            MM: b,
            y: b,
            yy: b,
          },
          ordinal: "%d.",
          week: { dow: 1, doy: 4 },
        });
      }),
      (function (a) {
        a(tb);
      })(function (a) {
        return a.defineLocale("eu", {
          months:
            "urtarrila_otsaila_martxoa_apirila_maiatza_ekaina_uztaila_abuztua_iraila_urria_azaroa_abendua".split(
              "_"
            ),
          monthsShort:
            "urt._ots._mar._api._mai._eka._uzt._abu._ira._urr._aza._abe.".split(
              "_"
            ),
          weekdays:
            "igandea_astelehena_asteartea_asteazkena_osteguna_ostirala_larunbata".split(
              "_"
            ),
          weekdaysShort: "ig._al._ar._az._og._ol._lr.".split("_"),
          weekdaysMin: "ig_al_ar_az_og_ol_lr".split("_"),
          longDateFormat: {
            LT: "HH:mm",
            L: "YYYY-MM-DD",
            LL: "YYYY[ko] MMMM[ren] D[a]",
            LLL: "YYYY[ko] MMMM[ren] D[a] LT",
            LLLL: "dddd, YYYY[ko] MMMM[ren] D[a] LT",
            l: "YYYY-M-D",
            ll: "YYYY[ko] MMM D[a]",
            lll: "YYYY[ko] MMM D[a] LT",
            llll: "ddd, YYYY[ko] MMM D[a] LT",
          },
          calendar: {
            sameDay: "[gaur] LT[etan]",
            nextDay: "[bihar] LT[etan]",
            nextWeek: "dddd LT[etan]",
            lastDay: "[atzo] LT[etan]",
            lastWeek: "[aurreko] dddd LT[etan]",
            sameElse: "L",
          },
          relativeTime: {
            future: "%s barru",
            past: "duela %s",
            s: "segundo batzuk",
            m: "minutu bat",
            mm: "%d minutu",
            h: "ordu bat",
            hh: "%d ordu",
            d: "egun bat",
            dd: "%d egun",
            M: "hilabete bat",
            MM: "%d hilabete",
            y: "urte bat",
            yy: "%d urte",
          },
          ordinal: "%d.",
          week: { dow: 1, doy: 7 },
        });
      }),
      (function (a) {
        a(tb);
      })(function (a) {
        var b = {
            1: "Û±",
            2: "Û²",
            3: "Û³",
            4: "Û´",
            5: "Ûµ",
            6: "Û¶",
            7: "Û·",
            8: "Û¸",
            9: "Û¹",
            0: "Û°",
          },
          c = {
            "Û±": "1",
            "Û²": "2",
            "Û³": "3",
            "Û´": "4",
            Ûµ: "5",
            "Û¶": "6",
            "Û·": "7",
            "Û¸": "8",
            "Û¹": "9",
            "Û°": "0",
          };
        return a.defineLocale("fa", {
          months:
            "Ú˜Ø§Ù†ÙˆÛŒÙ‡_ÙÙˆØ±ÛŒÙ‡_Ù…Ø§Ø±Ø³_Ø¢ÙˆØ±ÛŒÙ„_Ù…Ù‡_Ú˜ÙˆØ¦Ù†_Ú˜ÙˆØ¦ÛŒÙ‡_Ø§ÙˆØª_Ø³Ù¾ØªØ§Ù…Ø¨Ø±_Ø§Ú©ØªØ¨Ø±_Ù†ÙˆØ§Ù…Ø¨Ø±_Ø¯Ø³Ø§Ù…Ø¨Ø±".split(
              "_"
            ),
          monthsShort:
            "Ú˜Ø§Ù†ÙˆÛŒÙ‡_ÙÙˆØ±ÛŒÙ‡_Ù…Ø§Ø±Ø³_Ø¢ÙˆØ±ÛŒÙ„_Ù…Ù‡_Ú˜ÙˆØ¦Ù†_Ú˜ÙˆØ¦ÛŒÙ‡_Ø§ÙˆØª_Ø³Ù¾ØªØ§Ù…Ø¨Ø±_Ø§Ú©ØªØ¨Ø±_Ù†ÙˆØ§Ù…Ø¨Ø±_Ø¯Ø³Ø§Ù…Ø¨Ø±".split(
              "_"
            ),
          weekdays:
            "ÛŒÚ©â€ŒØ´Ù†Ø¨Ù‡_Ø¯ÙˆØ´Ù†Ø¨Ù‡_Ø³Ù‡â€ŒØ´Ù†Ø¨Ù‡_Ú†Ù‡Ø§Ø±Ø´Ù†Ø¨Ù‡_Ù¾Ù†Ø¬â€ŒØ´Ù†Ø¨Ù‡_Ø¬Ù…Ø¹Ù‡_Ø´Ù†Ø¨Ù‡".split(
              "_"
            ),
          weekdaysShort:
            "ÛŒÚ©â€ŒØ´Ù†Ø¨Ù‡_Ø¯ÙˆØ´Ù†Ø¨Ù‡_Ø³Ù‡â€ŒØ´Ù†Ø¨Ù‡_Ú†Ù‡Ø§Ø±Ø´Ù†Ø¨Ù‡_Ù¾Ù†Ø¬â€ŒØ´Ù†Ø¨Ù‡_Ø¬Ù…Ø¹Ù‡_Ø´Ù†Ø¨Ù‡".split(
              "_"
            ),
          weekdaysMin: "ÛŒ_Ø¯_Ø³_Ú†_Ù¾_Ø¬_Ø´".split("_"),
          longDateFormat: {
            LT: "HH:mm",
            L: "DD/MM/YYYY",
            LL: "D MMMM YYYY",
            LLL: "D MMMM YYYY LT",
            LLLL: "dddd, D MMMM YYYY LT",
          },
          meridiem: function (a) {
            return 12 > a ? "Ù‚Ø¨Ù„ Ø§Ø² Ø¸Ù‡Ø±" : "Ø¨Ø¹Ø¯ Ø§Ø² Ø¸Ù‡Ø±";
          },
          calendar: {
            sameDay: "[Ø§Ù…Ø±ÙˆØ² Ø³Ø§Ø¹Øª] LT",
            nextDay: "[ÙØ±Ø¯Ø§ Ø³Ø§Ø¹Øª] LT",
            nextWeek: "dddd [Ø³Ø§Ø¹Øª] LT",
            lastDay: "[Ø¯ÛŒØ±ÙˆØ² Ø³Ø§Ø¹Øª] LT",
            lastWeek: "dddd [Ù¾ÛŒØ´] [Ø³Ø§Ø¹Øª] LT",
            sameElse: "L",
          },
          relativeTime: {
            future: "Ø¯Ø± %s",
            past: "%s Ù¾ÛŒØ´",
            s: "Ú†Ù†Ø¯ÛŒÙ† Ø«Ø§Ù†ÛŒÙ‡",
            m: "ÛŒÚ© Ø¯Ù‚ÛŒÙ‚Ù‡",
            mm: "%d Ø¯Ù‚ÛŒÙ‚Ù‡",
            h: "ÛŒÚ© Ø³Ø§Ø¹Øª",
            hh: "%d Ø³Ø§Ø¹Øª",
            d: "ÛŒÚ© Ø±ÙˆØ²",
            dd: "%d Ø±ÙˆØ²",
            M: "ÛŒÚ© Ù…Ø§Ù‡",
            MM: "%d Ù…Ø§Ù‡",
            y: "ÛŒÚ© Ø³Ø§Ù„",
            yy: "%d Ø³Ø§Ù„",
          },
          preparse: function (a) {
            return a
              .replace(/[Û°-Û¹]/g, function (a) {
                return c[a];
              })
              .replace(/ØŒ/g, ",");
          },
          postformat: function (a) {
            return a
              .replace(/\d/g, function (a) {
                return b[a];
              })
              .replace(/,/g, "ØŒ");
          },
          ordinal: "%dÙ…",
          week: { dow: 6, doy: 12 },
        });
      }),
      (function (a) {
        a(tb);
      })(function (a) {
        function b(a, b, d, e) {
          var f = "";
          switch (d) {
            case "s":
              return e ? "muutaman sekunnin" : "muutama sekunti";
            case "m":
              return e ? "minuutin" : "minuutti";
            case "mm":
              f = e ? "minuutin" : "minuuttia";
              break;
            case "h":
              return e ? "tunnin" : "tunti";
            case "hh":
              f = e ? "tunnin" : "tuntia";
              break;
            case "d":
              return e ? "pÃ¤ivÃ¤n" : "pÃ¤ivÃ¤";
            case "dd":
              f = e ? "pÃ¤ivÃ¤n" : "pÃ¤ivÃ¤Ã¤";
              break;
            case "M":
              return e ? "kuukauden" : "kuukausi";
            case "MM":
              f = e ? "kuukauden" : "kuukautta";
              break;
            case "y":
              return e ? "vuoden" : "vuosi";
            case "yy":
              f = e ? "vuoden" : "vuotta";
          }
          return (f = c(a, e) + " " + f);
        }
        function c(a, b) {
          return 10 > a ? (b ? e[a] : d[a]) : a;
        }
        var d =
            "nolla yksi kaksi kolme neljÃ¤ viisi kuusi seitsemÃ¤n kahdeksan yhdeksÃ¤n".split(
              " "
            ),
          e = [
            "nolla",
            "yhden",
            "kahden",
            "kolmen",
            "neljÃ¤n",
            "viiden",
            "kuuden",
            d[7],
            d[8],
            d[9],
          ];
        return a.defineLocale("fi", {
          months:
            "tammikuu_helmikuu_maaliskuu_huhtikuu_toukokuu_kesÃ¤kuu_heinÃ¤kuu_elokuu_syyskuu_lokakuu_marraskuu_joulukuu".split(
              "_"
            ),
          monthsShort:
            "tammi_helmi_maalis_huhti_touko_kesÃ¤_heinÃ¤_elo_syys_loka_marras_joulu".split(
              "_"
            ),
          weekdays:
            "sunnuntai_maanantai_tiistai_keskiviikko_torstai_perjantai_lauantai".split(
              "_"
            ),
          weekdaysShort: "su_ma_ti_ke_to_pe_la".split("_"),
          weekdaysMin: "su_ma_ti_ke_to_pe_la".split("_"),
          longDateFormat: {
            LT: "HH.mm",
            L: "DD.MM.YYYY",
            LL: "Do MMMM[ta] YYYY",
            LLL: "Do MMMM[ta] YYYY, [klo] LT",
            LLLL: "dddd, Do MMMM[ta] YYYY, [klo] LT",
            l: "D.M.YYYY",
            ll: "Do MMM YYYY",
            lll: "Do MMM YYYY, [klo] LT",
            llll: "ddd, Do MMM YYYY, [klo] LT",
          },
          calendar: {
            sameDay: "[tÃ¤nÃ¤Ã¤n] [klo] LT",
            nextDay: "[huomenna] [klo] LT",
            nextWeek: "dddd [klo] LT",
            lastDay: "[eilen] [klo] LT",
            lastWeek: "[viime] dddd[na] [klo] LT",
            sameElse: "L",
          },
          relativeTime: {
            future: "%s pÃ¤Ã¤stÃ¤",
            past: "%s sitten",
            s: b,
            m: b,
            mm: b,
            h: b,
            hh: b,
            d: b,
            dd: b,
            M: b,
            MM: b,
            y: b,
            yy: b,
          },
          ordinal: "%d.",
          week: { dow: 1, doy: 4 },
        });
      }),
      (function (a) {
        a(tb);
      })(function (a) {
        return a.defineLocale("fo", {
          months:
            "januar_februar_mars_aprÃ­l_mai_juni_juli_august_september_oktober_november_desember".split(
              "_"
            ),
          monthsShort: "jan_feb_mar_apr_mai_jun_jul_aug_sep_okt_nov_des".split(
            "_"
          ),
          weekdays:
            "sunnudagur_mÃ¡nadagur_tÃ½sdagur_mikudagur_hÃ³sdagur_frÃ­ggjadagur_leygardagur".split(
              "_"
            ),
          weekdaysShort: "sun_mÃ¡n_tÃ½s_mik_hÃ³s_frÃ­_ley".split("_"),
          weekdaysMin: "su_mÃ¡_tÃ½_mi_hÃ³_fr_le".split("_"),
          longDateFormat: {
            LT: "HH:mm",
            L: "DD/MM/YYYY",
            LL: "D MMMM YYYY",
            LLL: "D MMMM YYYY LT",
            LLLL: "dddd D. MMMM, YYYY LT",
          },
          calendar: {
            sameDay: "[Ã dag kl.] LT",
            nextDay: "[Ã morgin kl.] LT",
            nextWeek: "dddd [kl.] LT",
            lastDay: "[Ã gjÃ¡r kl.] LT",
            lastWeek: "[sÃ­Ã°stu] dddd [kl] LT",
            sameElse: "L",
          },
          relativeTime: {
            future: "um %s",
            past: "%s sÃ­Ã°ani",
            s: "fÃ¡ sekund",
            m: "ein minutt",
            mm: "%d minuttir",
            h: "ein tÃ­mi",
            hh: "%d tÃ­mar",
            d: "ein dagur",
            dd: "%d dagar",
            M: "ein mÃ¡naÃ°i",
            MM: "%d mÃ¡naÃ°ir",
            y: "eitt Ã¡r",
            yy: "%d Ã¡r",
          },
          ordinal: "%d.",
          week: { dow: 1, doy: 4 },
        });
      }),
      (function (a) {
        a(tb);
      })(function (a) {
        return a.defineLocale("fr-ca", {
          months:
            "janvier_fÃ©vrier_mars_avril_mai_juin_juillet_aoÃ»t_septembre_octobre_novembre_dÃ©cembre".split(
              "_"
            ),
          monthsShort:
            "janv._fÃ©vr._mars_avr._mai_juin_juil._aoÃ»t_sept._oct._nov._dÃ©c.".split(
              "_"
            ),
          weekdays: "dimanche_lundi_mardi_mercredi_jeudi_vendredi_samedi".split(
            "_"
          ),
          weekdaysShort: "dim._lun._mar._mer._jeu._ven._sam.".split("_"),
          weekdaysMin: "Di_Lu_Ma_Me_Je_Ve_Sa".split("_"),
          longDateFormat: {
            LT: "HH:mm",
            L: "YYYY-MM-DD",
            LL: "D MMMM YYYY",
            LLL: "D MMMM YYYY LT",
            LLLL: "dddd D MMMM YYYY LT",
          },
          calendar: {
            sameDay: "[Aujourd'hui Ã ] LT",
            nextDay: "[Demain Ã ] LT",
            nextWeek: "dddd [Ã ] LT",
            lastDay: "[Hier Ã ] LT",
            lastWeek: "dddd [dernier Ã ] LT",
            sameElse: "L",
          },
          relativeTime: {
            future: "dans %s",
            past: "il y a %s",
            s: "quelques secondes",
            m: "une minute",
            mm: "%d minutes",
            h: "une heure",
            hh: "%d heures",
            d: "un jour",
            dd: "%d jours",
            M: "un mois",
            MM: "%d mois",
            y: "un an",
            yy: "%d ans",
          },
          ordinal: function (a) {
            return a + (1 === a ? "er" : "");
          },
        });
      }),
      (function (a) {
        a(tb);
      })(function (a) {
        return a.defineLocale("fr", {
          months:
            "janvier_fÃ©vrier_mars_avril_mai_juin_juillet_aoÃ»t_septembre_octobre_novembre_dÃ©cembre".split(
              "_"
            ),
          monthsShort:
            "janv._fÃ©vr._mars_avr._mai_juin_juil._aoÃ»t_sept._oct._nov._dÃ©c.".split(
              "_"
            ),
          weekdays: "dimanche_lundi_mardi_mercredi_jeudi_vendredi_samedi".split(
            "_"
          ),
          weekdaysShort: "dim._lun._mar._mer._jeu._ven._sam.".split("_"),
          weekdaysMin: "Di_Lu_Ma_Me_Je_Ve_Sa".split("_"),
          longDateFormat: {
            LT: "HH:mm",
            L: "DD/MM/YYYY",
            LL: "D MMMM YYYY",
            LLL: "D MMMM YYYY LT",
            LLLL: "dddd D MMMM YYYY LT",
          },
          calendar: {
            sameDay: "[Aujourd'hui Ã ] LT",
            nextDay: "[Demain Ã ] LT",
            nextWeek: "dddd [Ã ] LT",
            lastDay: "[Hier Ã ] LT",
            lastWeek: "dddd [dernier Ã ] LT",
            sameElse: "L",
          },
          relativeTime: {
            future: "dans %s",
            past: "il y a %s",
            s: "quelques secondes",
            m: "une minute",
            mm: "%d minutes",
            h: "une heure",
            hh: "%d heures",
            d: "un jour",
            dd: "%d jours",
            M: "un mois",
            MM: "%d mois",
            y: "un an",
            yy: "%d ans",
          },
          ordinal: function (a) {
            return a + (1 === a ? "er" : "");
          },
          week: { dow: 1, doy: 4 },
        });
      }),
      (function (a) {
        a(tb);
      })(function (a) {
        return a.defineLocale("gl", {
          months:
            "Xaneiro_Febreiro_Marzo_Abril_Maio_XuÃ±o_Xullo_Agosto_Setembro_Outubro_Novembro_Decembro".split(
              "_"
            ),
          monthsShort:
            "Xan._Feb._Mar._Abr._Mai._XuÃ±._Xul._Ago._Set._Out._Nov._Dec.".split(
              "_"
            ),
          weekdays: "Domingo_Luns_Martes_MÃ©rcores_Xoves_Venres_SÃ¡bado".split(
            "_"
          ),
          weekdaysShort: "Dom._Lun._Mar._MÃ©r._Xov._Ven._SÃ¡b.".split("_"),
          weekdaysMin: "Do_Lu_Ma_MÃ©_Xo_Ve_SÃ¡".split("_"),
          longDateFormat: {
            LT: "H:mm",
            L: "DD/MM/YYYY",
            LL: "D MMMM YYYY",
            LLL: "D MMMM YYYY LT",
            LLLL: "dddd D MMMM YYYY LT",
          },
          calendar: {
            sameDay: function () {
              return "[hoxe " + (1 !== this.hours() ? "Ã¡s" : "Ã¡") + "] LT";
            },
            nextDay: function () {
              return "[maÃ±Ã¡ " + (1 !== this.hours() ? "Ã¡s" : "Ã¡") + "] LT";
            },
            nextWeek: function () {
              return "dddd [" + (1 !== this.hours() ? "Ã¡s" : "a") + "] LT";
            },
            lastDay: function () {
              return "[onte " + (1 !== this.hours() ? "Ã¡" : "a") + "] LT";
            },
            lastWeek: function () {
              return (
                "[o] dddd [pasado " +
                (1 !== this.hours() ? "Ã¡s" : "a") +
                "] LT"
              );
            },
            sameElse: "L",
          },
          relativeTime: {
            future: function (a) {
              return "uns segundos" === a ? "nuns segundos" : "en " + a;
            },
            past: "hai %s",
            s: "uns segundos",
            m: "un minuto",
            mm: "%d minutos",
            h: "unha hora",
            hh: "%d horas",
            d: "un dÃ­a",
            dd: "%d dÃ­as",
            M: "un mes",
            MM: "%d meses",
            y: "un ano",
            yy: "%d anos",
          },
          ordinal: "%dÂº",
          week: { dow: 1, doy: 7 },
        });
      }),
      (function (a) {
        a(tb);
      })(function (a) {
        return a.defineLocale("he", {
          months:
            "×™× ×•××¨_×¤×‘×¨×•××¨_×ž×¨×¥_××¤×¨×™×œ_×ž××™_×™×•× ×™_×™×•×œ×™_××•×’×•×¡×˜_×¡×¤×˜×ž×‘×¨_××•×§×˜×•×‘×¨_× ×•×‘×ž×‘×¨_×“×¦×ž×‘×¨".split(
              "_"
            ),
          monthsShort:
            "×™× ×•×³_×¤×‘×¨×³_×ž×¨×¥_××¤×¨×³_×ž××™_×™×•× ×™_×™×•×œ×™_××•×’×³_×¡×¤×˜×³_××•×§×³_× ×•×‘×³_×“×¦×ž×³".split(
              "_"
            ),
          weekdays:
            "×¨××©×•×Ÿ_×©× ×™_×©×œ×™×©×™_×¨×‘×™×¢×™_×—×ž×™×©×™_×©×™×©×™_×©×‘×ª".split(
              "_"
            ),
          weekdaysShort: "××³_×‘×³_×’×³_×“×³_×”×³_×•×³_×©×³".split("_"),
          weekdaysMin: "×_×‘_×’_×“_×”_×•_×©".split("_"),
          longDateFormat: {
            LT: "HH:mm",
            L: "DD/MM/YYYY",
            LL: "D [×‘]MMMM YYYY",
            LLL: "D [×‘]MMMM YYYY LT",
            LLLL: "dddd, D [×‘]MMMM YYYY LT",
            l: "D/M/YYYY",
            ll: "D MMM YYYY",
            lll: "D MMM YYYY LT",
            llll: "ddd, D MMM YYYY LT",
          },
          calendar: {
            sameDay: "[×”×™×•× ×‘Ö¾]LT",
            nextDay: "[×ž×—×¨ ×‘Ö¾]LT",
            nextWeek: "dddd [×‘×©×¢×”] LT",
            lastDay: "[××ª×ž×•×œ ×‘Ö¾]LT",
            lastWeek: "[×‘×™×•×] dddd [×”××—×¨×•×Ÿ ×‘×©×¢×”] LT",
            sameElse: "L",
          },
          relativeTime: {
            future: "×‘×¢×•×“ %s",
            past: "×œ×¤× ×™ %s",
            s: "×ž×¡×¤×¨ ×©× ×™×•×ª",
            m: "×“×§×”",
            mm: "%d ×“×§×•×ª",
            h: "×©×¢×”",
            hh: function (a) {
              return 2 === a ? "×©×¢×ª×™×™×" : a + " ×©×¢×•×ª";
            },
            d: "×™×•×",
            dd: function (a) {
              return 2 === a ? "×™×•×ž×™×™×" : a + " ×™×ž×™×";
            },
            M: "×—×•×“×©",
            MM: function (a) {
              return 2 === a ? "×—×•×“×©×™×™×" : a + " ×—×•×“×©×™×";
            },
            y: "×©× ×”",
            yy: function (a) {
              return 2 === a ? "×©× ×ª×™×™×" : a + " ×©× ×™×";
            },
          },
        });
      }),
      (function (a) {
        a(tb);
      })(function (a) {
        var b = {
            1: "à¥§",
            2: "à¥¨",
            3: "à¥©",
            4: "à¥ª",
            5: "à¥«",
            6: "à¥¬",
            7: "à¥­",
            8: "à¥®",
            9: "à¥¯",
            0: "à¥¦",
          },
          c = {
            "à¥§": "1",
            "à¥¨": "2",
            "à¥©": "3",
            "à¥ª": "4",
            "à¥«": "5",
            "à¥¬": "6",
            "à¥­": "7",
            "à¥®": "8",
            "à¥¯": "9",
            "à¥¦": "0",
          };
        return a.defineLocale("hi", {
          months:
            "à¤œà¤¨à¤µà¤°à¥€_à¤«à¤¼à¤°à¤µà¤°à¥€_à¤®à¤¾à¤°à¥à¤š_à¤…à¤ªà¥à¤°à¥ˆà¤²_à¤®à¤ˆ_à¤œà¥‚à¤¨_à¤œà¥à¤²à¤¾à¤ˆ_à¤…à¤—à¤¸à¥à¤¤_à¤¸à¤¿à¤¤à¤®à¥à¤¬à¤°_à¤…à¤•à¥à¤Ÿà¥‚à¤¬à¤°_à¤¨à¤µà¤®à¥à¤¬à¤°_à¤¦à¤¿à¤¸à¤®à¥à¤¬à¤°".split(
              "_"
            ),
          monthsShort:
            "à¤œà¤¨._à¤«à¤¼à¤°._à¤®à¤¾à¤°à¥à¤š_à¤…à¤ªà¥à¤°à¥ˆ._à¤®à¤ˆ_à¤œà¥‚à¤¨_à¤œà¥à¤²._à¤…à¤—._à¤¸à¤¿à¤¤._à¤…à¤•à¥à¤Ÿà¥‚._à¤¨à¤µ._à¤¦à¤¿à¤¸.".split(
              "_"
            ),
          weekdays:
            "à¤°à¤µà¤¿à¤µà¤¾à¤°_à¤¸à¥‹à¤®à¤µà¤¾à¤°_à¤®à¤‚à¤—à¤²à¤µà¤¾à¤°_à¤¬à¥à¤§à¤µà¤¾à¤°_à¤—à¥à¤°à¥‚à¤µà¤¾à¤°_à¤¶à¥à¤•à¥à¤°à¤µà¤¾à¤°_à¤¶à¤¨à¤¿à¤µà¤¾à¤°".split(
              "_"
            ),
          weekdaysShort:
            "à¤°à¤µà¤¿_à¤¸à¥‹à¤®_à¤®à¤‚à¤—à¤²_à¤¬à¥à¤§_à¤—à¥à¤°à¥‚_à¤¶à¥à¤•à¥à¤°_à¤¶à¤¨à¤¿".split(
              "_"
            ),
          weekdaysMin: "à¤°_à¤¸à¥‹_à¤®à¤‚_à¤¬à¥_à¤—à¥_à¤¶à¥_à¤¶".split("_"),
          longDateFormat: {
            LT: "A h:mm à¤¬à¤œà¥‡",
            L: "DD/MM/YYYY",
            LL: "D MMMM YYYY",
            LLL: "D MMMM YYYY, LT",
            LLLL: "dddd, D MMMM YYYY, LT",
          },
          calendar: {
            sameDay: "[à¤†à¤œ] LT",
            nextDay: "[à¤•à¤²] LT",
            nextWeek: "dddd, LT",
            lastDay: "[à¤•à¤²] LT",
            lastWeek: "[à¤ªà¤¿à¤›à¤²à¥‡] dddd, LT",
            sameElse: "L",
          },
          relativeTime: {
            future: "%s à¤®à¥‡à¤‚",
            past: "%s à¤ªà¤¹à¤²à¥‡",
            s: "à¤•à¥à¤› à¤¹à¥€ à¤•à¥à¤·à¤£",
            m: "à¤à¤• à¤®à¤¿à¤¨à¤Ÿ",
            mm: "%d à¤®à¤¿à¤¨à¤Ÿ",
            h: "à¤à¤• à¤˜à¤‚à¤Ÿà¤¾",
            hh: "%d à¤˜à¤‚à¤Ÿà¥‡",
            d: "à¤à¤• à¤¦à¤¿à¤¨",
            dd: "%d à¤¦à¤¿à¤¨",
            M: "à¤à¤• à¤®à¤¹à¥€à¤¨à¥‡",
            MM: "%d à¤®à¤¹à¥€à¤¨à¥‡",
            y: "à¤à¤• à¤µà¤°à¥à¤·",
            yy: "%d à¤µà¤°à¥à¤·",
          },
          preparse: function (a) {
            return a.replace(/[à¥§à¥¨à¥©à¥ªà¥«à¥¬à¥­à¥®à¥¯à¥¦]/g, function (a) {
              return c[a];
            });
          },
          postformat: function (a) {
            return a.replace(/\d/g, function (a) {
              return b[a];
            });
          },
          meridiem: function (a) {
            return 4 > a
              ? "à¤°à¤¾à¤¤"
              : 10 > a
              ? "à¤¸à¥à¤¬à¤¹"
              : 17 > a
              ? "à¤¦à¥‹à¤ªà¤¹à¤°"
              : 20 > a
              ? "à¤¶à¤¾à¤®"
              : "à¤°à¤¾à¤¤";
          },
          week: { dow: 0, doy: 6 },
        });
      }),
      (function (a) {
        a(tb);
      })(function (a) {
        function b(a, b, c) {
          var d = a + " ";
          switch (c) {
            case "m":
              return b ? "jedna minuta" : "jedne minute";
            case "mm":
              return (d +=
                1 === a
                  ? "minuta"
                  : 2 === a || 3 === a || 4 === a
                  ? "minute"
                  : "minuta");
            case "h":
              return b ? "jedan sat" : "jednog sata";
            case "hh":
              return (d +=
                1 === a
                  ? "sat"
                  : 2 === a || 3 === a || 4 === a
                  ? "sata"
                  : "sati");
            case "dd":
              return (d += 1 === a ? "dan" : "dana");
            case "MM":
              return (d +=
                1 === a
                  ? "mjesec"
                  : 2 === a || 3 === a || 4 === a
                  ? "mjeseca"
                  : "mjeseci");
            case "yy":
              return (d +=
                1 === a
                  ? "godina"
                  : 2 === a || 3 === a || 4 === a
                  ? "godine"
                  : "godina");
          }
        }
        return a.defineLocale("hr", {
          months:
            "sjeÄanj_veljaÄa_oÅ¾ujak_travanj_svibanj_lipanj_srpanj_kolovoz_rujan_listopad_studeni_prosinac".split(
              "_"
            ),
          monthsShort:
            "sje._vel._oÅ¾u._tra._svi._lip._srp._kol._ruj._lis._stu._pro.".split(
              "_"
            ),
          weekdays:
            "nedjelja_ponedjeljak_utorak_srijeda_Äetvrtak_petak_subota".split(
              "_"
            ),
          weekdaysShort: "ned._pon._uto._sri._Äet._pet._sub.".split("_"),
          weekdaysMin: "ne_po_ut_sr_Äe_pe_su".split("_"),
          longDateFormat: {
            LT: "H:mm",
            L: "DD. MM. YYYY",
            LL: "D. MMMM YYYY",
            LLL: "D. MMMM YYYY LT",
            LLLL: "dddd, D. MMMM YYYY LT",
          },
          calendar: {
            sameDay: "[danas u] LT",
            nextDay: "[sutra u] LT",
            nextWeek: function () {
              switch (this.day()) {
                case 0:
                  return "[u] [nedjelju] [u] LT";
                case 3:
                  return "[u] [srijedu] [u] LT";
                case 6:
                  return "[u] [subotu] [u] LT";
                case 1:
                case 2:
                case 4:
                case 5:
                  return "[u] dddd [u] LT";
              }
            },
            lastDay: "[juÄer u] LT",
            lastWeek: function () {
              switch (this.day()) {
                case 0:
                case 3:
                  return "[proÅ¡lu] dddd [u] LT";
                case 6:
                  return "[proÅ¡le] [subote] [u] LT";
                case 1:
                case 2:
                case 4:
                case 5:
                  return "[proÅ¡li] dddd [u] LT";
              }
            },
            sameElse: "L",
          },
          relativeTime: {
            future: "za %s",
            past: "prije %s",
            s: "par sekundi",
            m: b,
            mm: b,
            h: b,
            hh: b,
            d: "dan",
            dd: b,
            M: "mjesec",
            MM: b,
            y: "godinu",
            yy: b,
          },
          ordinal: "%d.",
          week: { dow: 1, doy: 7 },
        });
      }),
      (function (a) {
        a(tb);
      })(function (a) {
        function b(a, b, c, d) {
          var e = a;
          switch (c) {
            case "s":
              return d || b ? "nÃ©hÃ¡ny mÃ¡sodperc" : "nÃ©hÃ¡ny mÃ¡sodperce";
            case "m":
              return "egy" + (d || b ? " perc" : " perce");
            case "mm":
              return e + (d || b ? " perc" : " perce");
            case "h":
              return "egy" + (d || b ? " Ã³ra" : " Ã³rÃ¡ja");
            case "hh":
              return e + (d || b ? " Ã³ra" : " Ã³rÃ¡ja");
            case "d":
              return "egy" + (d || b ? " nap" : " napja");
            case "dd":
              return e + (d || b ? " nap" : " napja");
            case "M":
              return "egy" + (d || b ? " hÃ³nap" : " hÃ³napja");
            case "MM":
              return e + (d || b ? " hÃ³nap" : " hÃ³napja");
            case "y":
              return "egy" + (d || b ? " Ã©v" : " Ã©ve");
            case "yy":
              return e + (d || b ? " Ã©v" : " Ã©ve");
          }
          return "";
        }
        function c(a) {
          return (a ? "" : "[mÃºlt] ") + "[" + d[this.day()] + "] LT[-kor]";
        }
        var d =
          "vasÃ¡rnap hÃ©tfÅ‘n kedden szerdÃ¡n csÃ¼tÃ¶rtÃ¶kÃ¶n pÃ©nteken szombaton".split(
            " "
          );
        return a.defineLocale("hu", {
          months:
            "januÃ¡r_februÃ¡r_mÃ¡rcius_Ã¡prilis_mÃ¡jus_jÃºnius_jÃºlius_augusztus_szeptember_oktÃ³ber_november_december".split(
              "_"
            ),
          monthsShort:
            "jan_feb_mÃ¡rc_Ã¡pr_mÃ¡j_jÃºn_jÃºl_aug_szept_okt_nov_dec".split(
              "_"
            ),
          weekdays:
            "vasÃ¡rnap_hÃ©tfÅ‘_kedd_szerda_csÃ¼tÃ¶rtÃ¶k_pÃ©ntek_szombat".split(
              "_"
            ),
          weekdaysShort: "vas_hÃ©t_kedd_sze_csÃ¼t_pÃ©n_szo".split("_"),
          weekdaysMin: "v_h_k_sze_cs_p_szo".split("_"),
          longDateFormat: {
            LT: "H:mm",
            L: "YYYY.MM.DD.",
            LL: "YYYY. MMMM D.",
            LLL: "YYYY. MMMM D., LT",
            LLLL: "YYYY. MMMM D., dddd LT",
          },
          meridiem: function (a, b, c) {
            return 12 > a ? (c === !0 ? "de" : "DE") : c === !0 ? "du" : "DU";
          },
          calendar: {
            sameDay: "[ma] LT[-kor]",
            nextDay: "[holnap] LT[-kor]",
            nextWeek: function () {
              return c.call(this, !0);
            },
            lastDay: "[tegnap] LT[-kor]",
            lastWeek: function () {
              return c.call(this, !1);
            },
            sameElse: "L",
          },
          relativeTime: {
            future: "%s mÃºlva",
            past: "%s",
            s: b,
            m: b,
            mm: b,
            h: b,
            hh: b,
            d: b,
            dd: b,
            M: b,
            MM: b,
            y: b,
            yy: b,
          },
          ordinal: "%d.",
          week: { dow: 1, doy: 7 },
        });
      }),
      (function (a) {
        a(tb);
      })(function (a) {
        function b(a, b) {
          var c = {
              nominative:
                "Õ°Õ¸Ö‚Õ¶Õ¾Õ¡Ö€_ÖƒÕ¥Õ¿Ö€Õ¾Õ¡Ö€_Õ´Õ¡Ö€Õ¿_Õ¡ÕºÖ€Õ«Õ¬_Õ´Õ¡ÕµÕ«Õ½_Õ°Õ¸Ö‚Õ¶Õ«Õ½_Õ°Õ¸Ö‚Õ¬Õ«Õ½_Ö…Õ£Õ¸Õ½Õ¿Õ¸Õ½_Õ½Õ¥ÕºÕ¿Õ¥Õ´Õ¢Õ¥Ö€_Õ°Õ¸Õ¯Õ¿Õ¥Õ´Õ¢Õ¥Ö€_Õ¶Õ¸ÕµÕ¥Õ´Õ¢Õ¥Ö€_Õ¤Õ¥Õ¯Õ¿Õ¥Õ´Õ¢Õ¥Ö€".split(
                  "_"
                ),
              accusative:
                "Õ°Õ¸Ö‚Õ¶Õ¾Õ¡Ö€Õ«_ÖƒÕ¥Õ¿Ö€Õ¾Õ¡Ö€Õ«_Õ´Õ¡Ö€Õ¿Õ«_Õ¡ÕºÖ€Õ«Õ¬Õ«_Õ´Õ¡ÕµÕ«Õ½Õ«_Õ°Õ¸Ö‚Õ¶Õ«Õ½Õ«_Õ°Õ¸Ö‚Õ¬Õ«Õ½Õ«_Ö…Õ£Õ¸Õ½Õ¿Õ¸Õ½Õ«_Õ½Õ¥ÕºÕ¿Õ¥Õ´Õ¢Õ¥Ö€Õ«_Õ°Õ¸Õ¯Õ¿Õ¥Õ´Õ¢Õ¥Ö€Õ«_Õ¶Õ¸ÕµÕ¥Õ´Õ¢Õ¥Ö€Õ«_Õ¤Õ¥Õ¯Õ¿Õ¥Õ´Õ¢Õ¥Ö€Õ«".split(
                  "_"
                ),
            },
            d = /D[oD]?(\[[^\[\]]*\]|\s+)+MMMM?/.test(b)
              ? "accusative"
              : "nominative";
          return c[d][a.month()];
        }
        function c(a) {
          var b =
            "Õ°Õ¶Õ¾_ÖƒÕ¿Ö€_Õ´Ö€Õ¿_Õ¡ÕºÖ€_Õ´ÕµÕ½_Õ°Õ¶Õ½_Õ°Õ¬Õ½_Ö…Õ£Õ½_Õ½ÕºÕ¿_Õ°Õ¯Õ¿_Õ¶Õ´Õ¢_Õ¤Õ¯Õ¿".split(
              "_"
            );
          return b[a.month()];
        }
        function d(a) {
          var b =
            "Õ¯Õ«Ö€Õ¡Õ¯Õ«_Õ¥Ö€Õ¯Õ¸Ö‚Õ·Õ¡Õ¢Õ©Õ«_Õ¥Ö€Õ¥Ö„Õ·Õ¡Õ¢Õ©Õ«_Õ¹Õ¸Ö€Õ¥Ö„Õ·Õ¡Õ¢Õ©Õ«_Õ°Õ«Õ¶Õ£Õ·Õ¡Õ¢Õ©Õ«_Õ¸Ö‚Ö€Õ¢Õ¡Õ©_Õ·Õ¡Õ¢Õ¡Õ©".split(
              "_"
            );
          return b[a.day()];
        }
        return a.defineLocale("hy-am", {
          months: b,
          monthsShort: c,
          weekdays: d,
          weekdaysShort:
            "Õ¯Ö€Õ¯_Õ¥Ö€Õ¯_Õ¥Ö€Ö„_Õ¹Ö€Ö„_Õ°Õ¶Õ£_Õ¸Ö‚Ö€Õ¢_Õ·Õ¢Õ©".split("_"),
          weekdaysMin:
            "Õ¯Ö€Õ¯_Õ¥Ö€Õ¯_Õ¥Ö€Ö„_Õ¹Ö€Ö„_Õ°Õ¶Õ£_Õ¸Ö‚Ö€Õ¢_Õ·Õ¢Õ©".split("_"),
          longDateFormat: {
            LT: "HH:mm",
            L: "DD.MM.YYYY",
            LL: "D MMMM YYYY Õ©.",
            LLL: "D MMMM YYYY Õ©., LT",
            LLLL: "dddd, D MMMM YYYY Õ©., LT",
          },
          calendar: {
            sameDay: "[Õ¡ÕµÕ½Ö…Ö€] LT",
            nextDay: "[Õ¾Õ¡Õ²Õ¨] LT",
            lastDay: "[Õ¥Ö€Õ¥Õ¯] LT",
            nextWeek: function () {
              return "dddd [Ö…Ö€Õ¨ ÕªÕ¡Õ´Õ¨] LT";
            },
            lastWeek: function () {
              return "[Õ¡Õ¶ÖÕ¡Õ®] dddd [Ö…Ö€Õ¨ ÕªÕ¡Õ´Õ¨] LT";
            },
            sameElse: "L",
          },
          relativeTime: {
            future: "%s Õ°Õ¥Õ¿Õ¸",
            past: "%s Õ¡Õ¼Õ¡Õ»",
            s: "Õ´Õ« Ö„Õ¡Õ¶Õ« Õ¾Õ¡ÕµÖ€Õ¯ÕµÕ¡Õ¶",
            m: "Ö€Õ¸ÕºÕ¥",
            mm: "%d Ö€Õ¸ÕºÕ¥",
            h: "ÕªÕ¡Õ´",
            hh: "%d ÕªÕ¡Õ´",
            d: "Ö…Ö€",
            dd: "%d Ö…Ö€",
            M: "Õ¡Õ´Õ«Õ½",
            MM: "%d Õ¡Õ´Õ«Õ½",
            y: "Õ¿Õ¡Ö€Õ«",
            yy: "%d Õ¿Õ¡Ö€Õ«",
          },
          meridiem: function (a) {
            return 4 > a
              ? "Õ£Õ«Õ·Õ¥Ö€Õ¾Õ¡"
              : 12 > a
              ? "Õ¡Õ¼Õ¡Õ¾Õ¸Õ¿Õ¾Õ¡"
              : 17 > a
              ? "ÖÕ¥Ö€Õ¥Õ¯Õ¾Õ¡"
              : "Õ¥Ö€Õ¥Õ¯Õ¸ÕµÕ¡Õ¶";
          },
          ordinal: function (a, b) {
            switch (b) {
              case "DDD":
              case "w":
              case "W":
              case "DDDo":
                return 1 === a ? a + "-Õ«Õ¶" : a + "-Ö€Õ¤";
              default:
                return a;
            }
          },
          week: { dow: 1, doy: 7 },
        });
      }),
      (function (a) {
        a(tb);
      })(function (a) {
        return a.defineLocale("id", {
          months:
            "Januari_Februari_Maret_April_Mei_Juni_Juli_Agustus_September_Oktober_November_Desember".split(
              "_"
            ),
          monthsShort: "Jan_Feb_Mar_Apr_Mei_Jun_Jul_Ags_Sep_Okt_Nov_Des".split(
            "_"
          ),
          weekdays: "Minggu_Senin_Selasa_Rabu_Kamis_Jumat_Sabtu".split("_"),
          weekdaysShort: "Min_Sen_Sel_Rab_Kam_Jum_Sab".split("_"),
          weekdaysMin: "Mg_Sn_Sl_Rb_Km_Jm_Sb".split("_"),
          longDateFormat: {
            LT: "HH.mm",
            L: "DD/MM/YYYY",
            LL: "D MMMM YYYY",
            LLL: "D MMMM YYYY [pukul] LT",
            LLLL: "dddd, D MMMM YYYY [pukul] LT",
          },
          meridiem: function (a) {
            return 11 > a
              ? "pagi"
              : 15 > a
              ? "siang"
              : 19 > a
              ? "sore"
              : "malam";
          },
          calendar: {
            sameDay: "[Hari ini pukul] LT",
            nextDay: "[Besok pukul] LT",
            nextWeek: "dddd [pukul] LT",
            lastDay: "[Kemarin pukul] LT",
            lastWeek: "dddd [lalu pukul] LT",
            sameElse: "L",
          },
          relativeTime: {
            future: "dalam %s",
            past: "%s yang lalu",
            s: "beberapa detik",
            m: "semenit",
            mm: "%d menit",
            h: "sejam",
            hh: "%d jam",
            d: "sehari",
            dd: "%d hari",
            M: "sebulan",
            MM: "%d bulan",
            y: "setahun",
            yy: "%d tahun",
          },
          week: { dow: 1, doy: 7 },
        });
      }),
      (function (a) {
        a(tb);
      })(function (a) {
        function b(a) {
          return a % 100 === 11 ? !0 : a % 10 === 1 ? !1 : !0;
        }
        function c(a, c, d, e) {
          var f = a + " ";
          switch (d) {
            case "s":
              return c || e ? "nokkrar sekÃºndur" : "nokkrum sekÃºndum";
            case "m":
              return c ? "mÃ­nÃºta" : "mÃ­nÃºtu";
            case "mm":
              return b(a)
                ? f + (c || e ? "mÃ­nÃºtur" : "mÃ­nÃºtum")
                : c
                ? f + "mÃ­nÃºta"
                : f + "mÃ­nÃºtu";
            case "hh":
              return b(a)
                ? f + (c || e ? "klukkustundir" : "klukkustundum")
                : f + "klukkustund";
            case "d":
              return c ? "dagur" : e ? "dag" : "degi";
            case "dd":
              return b(a)
                ? c
                  ? f + "dagar"
                  : f + (e ? "daga" : "dÃ¶gum")
                : c
                ? f + "dagur"
                : f + (e ? "dag" : "degi");
            case "M":
              return c ? "mÃ¡nuÃ°ur" : e ? "mÃ¡nuÃ°" : "mÃ¡nuÃ°i";
            case "MM":
              return b(a)
                ? c
                  ? f + "mÃ¡nuÃ°ir"
                  : f + (e ? "mÃ¡nuÃ°i" : "mÃ¡nuÃ°um")
                : c
                ? f + "mÃ¡nuÃ°ur"
                : f + (e ? "mÃ¡nuÃ°" : "mÃ¡nuÃ°i");
            case "y":
              return c || e ? "Ã¡r" : "Ã¡ri";
            case "yy":
              return b(a)
                ? f + (c || e ? "Ã¡r" : "Ã¡rum")
                : f + (c || e ? "Ã¡r" : "Ã¡ri");
          }
        }
        return a.defineLocale("is", {
          months:
            "janÃºar_febrÃºar_mars_aprÃ­l_maÃ­_jÃºnÃ­_jÃºlÃ­_Ã¡gÃºst_september_oktÃ³ber_nÃ³vember_desember".split(
              "_"
            ),
          monthsShort:
            "jan_feb_mar_apr_maÃ­_jÃºn_jÃºl_Ã¡gÃº_sep_okt_nÃ³v_des".split("_"),
          weekdays:
            "sunnudagur_mÃ¡nudagur_Ã¾riÃ°judagur_miÃ°vikudagur_fimmtudagur_fÃ¶studagur_laugardagur".split(
              "_"
            ),
          weekdaysShort: "sun_mÃ¡n_Ã¾ri_miÃ°_fim_fÃ¶s_lau".split("_"),
          weekdaysMin: "Su_MÃ¡_Ãžr_Mi_Fi_FÃ¶_La".split("_"),
          longDateFormat: {
            LT: "H:mm",
            L: "DD/MM/YYYY",
            LL: "D. MMMM YYYY",
            LLL: "D. MMMM YYYY [kl.] LT",
            LLLL: "dddd, D. MMMM YYYY [kl.] LT",
          },
          calendar: {
            sameDay: "[Ã­ dag kl.] LT",
            nextDay: "[Ã¡ morgun kl.] LT",
            nextWeek: "dddd [kl.] LT",
            lastDay: "[Ã­ gÃ¦r kl.] LT",
            lastWeek: "[sÃ­Ã°asta] dddd [kl.] LT",
            sameElse: "L",
          },
          relativeTime: {
            future: "eftir %s",
            past: "fyrir %s sÃ­Ã°an",
            s: c,
            m: c,
            mm: c,
            h: "klukkustund",
            hh: c,
            d: c,
            dd: c,
            M: c,
            MM: c,
            y: c,
            yy: c,
          },
          ordinal: "%d.",
          week: { dow: 1, doy: 4 },
        });
      }),
      (function (a) {
        a(tb);
      })(function (a) {
        return a.defineLocale("it", {
          months:
            "gennaio_febbraio_marzo_aprile_maggio_giugno_luglio_agosto_settembre_ottobre_novembre_dicembre".split(
              "_"
            ),
          monthsShort: "gen_feb_mar_apr_mag_giu_lug_ago_set_ott_nov_dic".split(
            "_"
          ),
          weekdays:
            "Domenica_LunedÃ¬_MartedÃ¬_MercoledÃ¬_GiovedÃ¬_VenerdÃ¬_Sabato".split(
              "_"
            ),
          weekdaysShort: "Dom_Lun_Mar_Mer_Gio_Ven_Sab".split("_"),
          weekdaysMin: "D_L_Ma_Me_G_V_S".split("_"),
          longDateFormat: {
            LT: "HH:mm",
            L: "DD/MM/YYYY",
            LL: "D MMMM YYYY",
            LLL: "D MMMM YYYY LT",
            LLLL: "dddd, D MMMM YYYY LT",
          },
          calendar: {
            sameDay: "[Oggi alle] LT",
            nextDay: "[Domani alle] LT",
            nextWeek: "dddd [alle] LT",
            lastDay: "[Ieri alle] LT",
            lastWeek: "[lo scorso] dddd [alle] LT",
            sameElse: "L",
          },
          relativeTime: {
            future: function (a) {
              return (/^[0-9].+$/.test(a) ? "tra" : "in") + " " + a;
            },
            past: "%s fa",
            s: "alcuni secondi",
            m: "un minuto",
            mm: "%d minuti",
            h: "un'ora",
            hh: "%d ore",
            d: "un giorno",
            dd: "%d giorni",
            M: "un mese",
            MM: "%d mesi",
            y: "un anno",
            yy: "%d anni",
          },
          ordinal: "%dÂº",
          week: { dow: 1, doy: 4 },
        });
      }),
      (function (a) {
        a(tb);
      })(function (a) {
        return a.defineLocale("ja", {
          months:
            "1æœˆ_2æœˆ_3æœˆ_4æœˆ_5æœˆ_6æœˆ_7æœˆ_8æœˆ_9æœˆ_10æœˆ_11æœˆ_12æœˆ".split(
              "_"
            ),
          monthsShort:
            "1æœˆ_2æœˆ_3æœˆ_4æœˆ_5æœˆ_6æœˆ_7æœˆ_8æœˆ_9æœˆ_10æœˆ_11æœˆ_12æœˆ".split(
              "_"
            ),
          weekdays:
            "æ—¥æ›œæ—¥_æœˆæ›œæ—¥_ç«æ›œæ—¥_æ°´æ›œæ—¥_æœ¨æ›œæ—¥_é‡‘æ›œæ—¥_åœŸæ›œæ—¥".split(
              "_"
            ),
          weekdaysShort: "æ—¥_æœˆ_ç«_æ°´_æœ¨_é‡‘_åœŸ".split("_"),
          weekdaysMin: "æ—¥_æœˆ_ç«_æ°´_æœ¨_é‡‘_åœŸ".split("_"),
          longDateFormat: {
            LT: "Ahæ™‚måˆ†",
            L: "YYYY/MM/DD",
            LL: "YYYYå¹´MæœˆDæ—¥",
            LLL: "YYYYå¹´MæœˆDæ—¥LT",
            LLLL: "YYYYå¹´MæœˆDæ—¥LT dddd",
          },
          meridiem: function (a) {
            return 12 > a ? "åˆå‰" : "åˆå¾Œ";
          },
          calendar: {
            sameDay: "[ä»Šæ—¥] LT",
            nextDay: "[æ˜Žæ—¥] LT",
            nextWeek: "[æ¥é€±]dddd LT",
            lastDay: "[æ˜¨æ—¥] LT",
            lastWeek: "[å‰é€±]dddd LT",
            sameElse: "L",
          },
          relativeTime: {
            future: "%så¾Œ",
            past: "%så‰",
            s: "æ•°ç§’",
            m: "1åˆ†",
            mm: "%dåˆ†",
            h: "1æ™‚é–“",
            hh: "%dæ™‚é–“",
            d: "1æ—¥",
            dd: "%dæ—¥",
            M: "1ãƒ¶æœˆ",
            MM: "%dãƒ¶æœˆ",
            y: "1å¹´",
            yy: "%då¹´",
          },
        });
      }),
      (function (a) {
        a(tb);
      })(function (a) {
        function b(a, b) {
          var c = {
              nominative:
                "áƒ˜áƒáƒœáƒ•áƒáƒ áƒ˜_áƒ—áƒ”áƒ‘áƒ”áƒ áƒ•áƒáƒšáƒ˜_áƒ›áƒáƒ áƒ¢áƒ˜_áƒáƒžáƒ áƒ˜áƒšáƒ˜_áƒ›áƒáƒ˜áƒ¡áƒ˜_áƒ˜áƒ•áƒœáƒ˜áƒ¡áƒ˜_áƒ˜áƒ•áƒšáƒ˜áƒ¡áƒ˜_áƒáƒ’áƒ•áƒ˜áƒ¡áƒ¢áƒ_áƒ¡áƒ”áƒ¥áƒ¢áƒ”áƒ›áƒ‘áƒ”áƒ áƒ˜_áƒáƒ¥áƒ¢áƒáƒ›áƒ‘áƒ”áƒ áƒ˜_áƒœáƒáƒ”áƒ›áƒ‘áƒ”áƒ áƒ˜_áƒ“áƒ”áƒ™áƒ”áƒ›áƒ‘áƒ”áƒ áƒ˜".split(
                  "_"
                ),
              accusative:
                "áƒ˜áƒáƒœáƒ•áƒáƒ áƒ¡_áƒ—áƒ”áƒ‘áƒ”áƒ áƒ•áƒáƒšáƒ¡_áƒ›áƒáƒ áƒ¢áƒ¡_áƒáƒžáƒ áƒ˜áƒšáƒ˜áƒ¡_áƒ›áƒáƒ˜áƒ¡áƒ¡_áƒ˜áƒ•áƒœáƒ˜áƒ¡áƒ¡_áƒ˜áƒ•áƒšáƒ˜áƒ¡áƒ¡_áƒáƒ’áƒ•áƒ˜áƒ¡áƒ¢áƒ¡_áƒ¡áƒ”áƒ¥áƒ¢áƒ”áƒ›áƒ‘áƒ”áƒ áƒ¡_áƒáƒ¥áƒ¢áƒáƒ›áƒ‘áƒ”áƒ áƒ¡_áƒœáƒáƒ”áƒ›áƒ‘áƒ”áƒ áƒ¡_áƒ“áƒ”áƒ™áƒ”áƒ›áƒ‘áƒ”áƒ áƒ¡".split(
                  "_"
                ),
            },
            d = /D[oD] *MMMM?/.test(b) ? "accusative" : "nominative";
          return c[d][a.month()];
        }
        function c(a, b) {
          var c = {
              nominative:
                "áƒ™áƒ•áƒ˜áƒ áƒ_áƒáƒ áƒ¨áƒáƒ‘áƒáƒ—áƒ˜_áƒ¡áƒáƒ›áƒ¨áƒáƒ‘áƒáƒ—áƒ˜_áƒáƒ—áƒ®áƒ¨áƒáƒ‘áƒáƒ—áƒ˜_áƒ®áƒ£áƒ—áƒ¨áƒáƒ‘áƒáƒ—áƒ˜_áƒžáƒáƒ áƒáƒ¡áƒ™áƒ”áƒ•áƒ˜_áƒ¨áƒáƒ‘áƒáƒ—áƒ˜".split(
                  "_"
                ),
              accusative:
                "áƒ™áƒ•áƒ˜áƒ áƒáƒ¡_áƒáƒ áƒ¨áƒáƒ‘áƒáƒ—áƒ¡_áƒ¡áƒáƒ›áƒ¨áƒáƒ‘áƒáƒ—áƒ¡_áƒáƒ—áƒ®áƒ¨áƒáƒ‘áƒáƒ—áƒ¡_áƒ®áƒ£áƒ—áƒ¨áƒáƒ‘áƒáƒ—áƒ¡_áƒžáƒáƒ áƒáƒ¡áƒ™áƒ”áƒ•áƒ¡_áƒ¨áƒáƒ‘áƒáƒ—áƒ¡".split(
                  "_"
                ),
            },
            d = /(áƒ¬áƒ˜áƒœáƒ|áƒ¨áƒ”áƒ›áƒ“áƒ”áƒ’)/.test(b)
              ? "accusative"
              : "nominative";
          return c[d][a.day()];
        }
        return a.defineLocale("ka", {
          months: b,
          monthsShort:
            "áƒ˜áƒáƒœ_áƒ—áƒ”áƒ‘_áƒ›áƒáƒ _áƒáƒžáƒ _áƒ›áƒáƒ˜_áƒ˜áƒ•áƒœ_áƒ˜áƒ•áƒš_áƒáƒ’áƒ•_áƒ¡áƒ”áƒ¥_áƒáƒ¥áƒ¢_áƒœáƒáƒ”_áƒ“áƒ”áƒ™".split(
              "_"
            ),
          weekdays: c,
          weekdaysShort:
            "áƒ™áƒ•áƒ˜_áƒáƒ áƒ¨_áƒ¡áƒáƒ›_áƒáƒ—áƒ®_áƒ®áƒ£áƒ—_áƒžáƒáƒ _áƒ¨áƒáƒ‘".split(
              "_"
            ),
          weekdaysMin: "áƒ™áƒ•_áƒáƒ _áƒ¡áƒ_áƒáƒ—_áƒ®áƒ£_áƒžáƒ_áƒ¨áƒ".split("_"),
          longDateFormat: {
            LT: "h:mm A",
            L: "DD/MM/YYYY",
            LL: "D MMMM YYYY",
            LLL: "D MMMM YYYY LT",
            LLLL: "dddd, D MMMM YYYY LT",
          },
          calendar: {
            sameDay: "[áƒ“áƒ¦áƒ”áƒ¡] LT[-áƒ–áƒ”]",
            nextDay: "[áƒ®áƒ•áƒáƒš] LT[-áƒ–áƒ”]",
            lastDay: "[áƒ’áƒ£áƒ¨áƒ˜áƒœ] LT[-áƒ–áƒ”]",
            nextWeek: "[áƒ¨áƒ”áƒ›áƒ“áƒ”áƒ’] dddd LT[-áƒ–áƒ”]",
            lastWeek: "[áƒ¬áƒ˜áƒœáƒ] dddd LT-áƒ–áƒ”",
            sameElse: "L",
          },
          relativeTime: {
            future: function (a) {
              return /(áƒ¬áƒáƒ›áƒ˜|áƒ¬áƒ£áƒ—áƒ˜|áƒ¡áƒáƒáƒ—áƒ˜|áƒ¬áƒ”áƒšáƒ˜)/.test(
                a
              )
                ? a.replace(/áƒ˜$/, "áƒ¨áƒ˜")
                : a + "áƒ¨áƒ˜";
            },
            past: function (a) {
              return /(áƒ¬áƒáƒ›áƒ˜|áƒ¬áƒ£áƒ—áƒ˜|áƒ¡áƒáƒáƒ—áƒ˜|áƒ“áƒ¦áƒ”|áƒ—áƒ•áƒ”)/.test(
                a
              )
                ? a.replace(/(áƒ˜|áƒ”)$/, "áƒ˜áƒ¡ áƒ¬áƒ˜áƒœ")
                : /áƒ¬áƒ”áƒšáƒ˜/.test(a)
                ? a.replace(/áƒ¬áƒ”áƒšáƒ˜$/, "áƒ¬áƒšáƒ˜áƒ¡ áƒ¬áƒ˜áƒœ")
                : void 0;
            },
            s: "áƒ áƒáƒ›áƒ“áƒ”áƒœáƒ˜áƒ›áƒ” áƒ¬áƒáƒ›áƒ˜",
            m: "áƒ¬áƒ£áƒ—áƒ˜",
            mm: "%d áƒ¬áƒ£áƒ—áƒ˜",
            h: "áƒ¡áƒáƒáƒ—áƒ˜",
            hh: "%d áƒ¡áƒáƒáƒ—áƒ˜",
            d: "áƒ“áƒ¦áƒ”",
            dd: "%d áƒ“áƒ¦áƒ”",
            M: "áƒ—áƒ•áƒ”",
            MM: "%d áƒ—áƒ•áƒ”",
            y: "áƒ¬áƒ”áƒšáƒ˜",
            yy: "%d áƒ¬áƒ”áƒšáƒ˜",
          },
          ordinal: function (a) {
            return 0 === a
              ? a
              : 1 === a
              ? a + "-áƒšáƒ˜"
              : 20 > a || (100 >= a && a % 20 === 0) || a % 100 === 0
              ? "áƒ›áƒ”-" + a
              : a + "-áƒ”";
          },
          week: { dow: 1, doy: 7 },
        });
      }),
      (function (a) {
        a(tb);
      })(function (a) {
        return a.defineLocale("km", {
          months:
            "áž˜áž€ážšáž¶_áž€áž»áž˜áŸ’áž—áŸˆ_áž˜áž·áž“áž¶_áž˜áŸážŸáž¶_áž§ážŸáž—áž¶_áž˜áž·ážáž»áž“áž¶_áž€áž€áŸ’áž€ážŠáž¶_ážŸáž¸áž áž¶_áž€áž‰áŸ’áž‰áž¶_ážáž»áž›áž¶_ážœáž·áž…áŸ’áž†áž·áž€áž¶_áž’áŸ’áž“áž¼".split(
              "_"
            ),
          monthsShort:
            "áž˜áž€ážšáž¶_áž€áž»áž˜áŸ’áž—áŸˆ_áž˜áž·áž“áž¶_áž˜áŸážŸáž¶_áž§ážŸáž—áž¶_áž˜áž·ážáž»áž“áž¶_áž€áž€áŸ’áž€ážŠáž¶_ážŸáž¸áž áž¶_áž€áž‰áŸ’áž‰áž¶_ážáž»áž›áž¶_ážœáž·áž…áŸ’áž†áž·áž€áž¶_áž’áŸ’áž“áž¼".split(
              "_"
            ),
          weekdays:
            "áž¢áž¶áž‘áž·ážáŸ’áž™_áž…áŸáž“áŸ’áž‘_áž¢áž„áŸ’áž‚áž¶ážš_áž–áž»áž’_áž–áŸ’ážšáž ážŸáŸ’áž”ážáž·áŸ_ážŸáž»áž€áŸ’ážš_ážŸáŸ…ážšáŸ".split(
              "_"
            ),
          weekdaysShort:
            "áž¢áž¶áž‘áž·ážáŸ’áž™_áž…áŸáž“áŸ’áž‘_áž¢áž„áŸ’áž‚áž¶ážš_áž–áž»áž’_áž–áŸ’ážšáž ážŸáŸ’áž”ážáž·áŸ_ážŸáž»áž€áŸ’ážš_ážŸáŸ…ážšáŸ".split(
              "_"
            ),
          weekdaysMin:
            "áž¢áž¶áž‘áž·ážáŸ’áž™_áž…áŸáž“áŸ’áž‘_áž¢áž„áŸ’áž‚áž¶ážš_áž–áž»áž’_áž–áŸ’ážšáž ážŸáŸ’áž”ážáž·áŸ_ážŸáž»áž€áŸ’ážš_ážŸáŸ…ážšáŸ".split(
              "_"
            ),
          longDateFormat: {
            LT: "HH:mm",
            L: "DD/MM/YYYY",
            LL: "D MMMM YYYY",
            LLL: "D MMMM YYYY LT",
            LLLL: "dddd, D MMMM YYYY LT",
          },
          calendar: {
            sameDay: "[ážáŸ’áž„áŸƒáž“áŸˆ áž˜áŸ‰áŸ„áž„] LT",
            nextDay: "[ážŸáŸ’áž¢áŸ‚áž€ áž˜áŸ‰áŸ„áž„] LT",
            nextWeek: "dddd [áž˜áŸ‰áŸ„áž„] LT",
            lastDay: "[áž˜áŸ’ážŸáž·áž›áž˜áž·áž‰ áž˜áŸ‰áŸ„áž„] LT",
            lastWeek: "dddd [ážŸáž”áŸ’ážáž¶áž áŸáž˜áž»áž“] [áž˜áŸ‰áŸ„áž„] LT",
            sameElse: "L",
          },
          relativeTime: {
            future: "%sáž‘áŸ€áž",
            past: "%sáž˜áž»áž“",
            s: "áž”áŸ‰áž»áž“áŸ’áž˜áž¶áž“ážœáž·áž“áž¶áž‘áž¸",
            m: "áž˜áž½áž™áž“áž¶áž‘áž¸",
            mm: "%d áž“áž¶áž‘áž¸",
            h: "áž˜áž½áž™áž˜áŸ‰áŸ„áž„",
            hh: "%d áž˜áŸ‰áŸ„áž„",
            d: "áž˜áž½áž™ážáŸ’áž„áŸƒ",
            dd: "%d ážáŸ’áž„áŸƒ",
            M: "áž˜áž½áž™ážáŸ‚",
            MM: "%d ážáŸ‚",
            y: "áž˜áž½áž™áž†áŸ’áž“áž¶áŸ†",
            yy: "%d áž†áŸ’áž“áž¶áŸ†",
          },
          week: { dow: 1, doy: 4 },
        });
      }),
      (function (a) {
        a(tb);
      })(function (a) {
        return a.defineLocale("ko", {
          months:
            "1ì›”_2ì›”_3ì›”_4ì›”_5ì›”_6ì›”_7ì›”_8ì›”_9ì›”_10ì›”_11ì›”_12ì›”".split(
              "_"
            ),
          monthsShort:
            "1ì›”_2ì›”_3ì›”_4ì›”_5ì›”_6ì›”_7ì›”_8ì›”_9ì›”_10ì›”_11ì›”_12ì›”".split(
              "_"
            ),
          weekdays:
            "ì¼ìš”ì¼_ì›”ìš”ì¼_í™”ìš”ì¼_ìˆ˜ìš”ì¼_ëª©ìš”ì¼_ê¸ˆìš”ì¼_í† ìš”ì¼".split(
              "_"
            ),
          weekdaysShort: "ì¼_ì›”_í™”_ìˆ˜_ëª©_ê¸ˆ_í† ".split("_"),
          weekdaysMin: "ì¼_ì›”_í™”_ìˆ˜_ëª©_ê¸ˆ_í† ".split("_"),
          longDateFormat: {
            LT: "A hì‹œ më¶„",
            L: "YYYY.MM.DD",
            LL: "YYYYë…„ MMMM Dì¼",
            LLL: "YYYYë…„ MMMM Dì¼ LT",
            LLLL: "YYYYë…„ MMMM Dì¼ dddd LT",
          },
          meridiem: function (a) {
            return 12 > a ? "ì˜¤ì „" : "ì˜¤í›„";
          },
          calendar: {
            sameDay: "ì˜¤ëŠ˜ LT",
            nextDay: "ë‚´ì¼ LT",
            nextWeek: "dddd LT",
            lastDay: "ì–´ì œ LT",
            lastWeek: "ì§€ë‚œì£¼ dddd LT",
            sameElse: "L",
          },
          relativeTime: {
            future: "%s í›„",
            past: "%s ì „",
            s: "ëª‡ì´ˆ",
            ss: "%dì´ˆ",
            m: "ì¼ë¶„",
            mm: "%dë¶„",
            h: "í•œì‹œê°„",
            hh: "%dì‹œê°„",
            d: "í•˜ë£¨",
            dd: "%dì¼",
            M: "í•œë‹¬",
            MM: "%dë‹¬",
            y: "ì¼ë…„",
            yy: "%dë…„",
          },
          ordinal: "%dì¼",
          meridiemParse: /(ì˜¤ì „|ì˜¤í›„)/,
          isPM: function (a) {
            return "ì˜¤í›„" === a;
          },
        });
      }),
      (function (a) {
        a(tb);
      })(function (a) {
        function b(a, b, c) {
          var d = {
            m: ["eng Minutt", "enger Minutt"],
            h: ["eng Stonn", "enger Stonn"],
            d: ["een Dag", "engem Dag"],
            M: ["ee Mount", "engem Mount"],
            y: ["ee Joer", "engem Joer"],
          };
          return b ? d[c][0] : d[c][1];
        }
        function c(a) {
          var b = a.substr(0, a.indexOf(" "));
          return e(b) ? "a " + a : "an " + a;
        }
        function d(a) {
          var b = a.substr(0, a.indexOf(" "));
          return e(b) ? "viru " + a : "virun " + a;
        }
        function e(a) {
          if (((a = parseInt(a, 10)), isNaN(a))) return !1;
          if (0 > a) return !0;
          if (10 > a) return a >= 4 && 7 >= a ? !0 : !1;
          if (100 > a) {
            var b = a % 10,
              c = a / 10;
            return e(0 === b ? c : b);
          }
          if (1e4 > a) {
            for (; a >= 10; ) a /= 10;
            return e(a);
          }
          return (a /= 1e3), e(a);
        }
        return a.defineLocale("lb", {
          months:
            "Januar_Februar_MÃ¤erz_AbrÃ«ll_Mee_Juni_Juli_August_September_Oktober_November_Dezember".split(
              "_"
            ),
          monthsShort:
            "Jan._Febr._Mrz._Abr._Mee_Jun._Jul._Aug._Sept._Okt._Nov._Dez.".split(
              "_"
            ),
          weekdays:
            "Sonndeg_MÃ©indeg_DÃ«nschdeg_MÃ«ttwoch_Donneschdeg_Freideg_Samschdeg".split(
              "_"
            ),
          weekdaysShort: "So._MÃ©._DÃ«._MÃ«._Do._Fr._Sa.".split("_"),
          weekdaysMin: "So_MÃ©_DÃ«_MÃ«_Do_Fr_Sa".split("_"),
          longDateFormat: {
            LT: "H:mm [Auer]",
            L: "DD.MM.YYYY",
            LL: "D. MMMM YYYY",
            LLL: "D. MMMM YYYY LT",
            LLLL: "dddd, D. MMMM YYYY LT",
          },
          calendar: {
            sameDay: "[Haut um] LT",
            sameElse: "L",
            nextDay: "[Muer um] LT",
            nextWeek: "dddd [um] LT",
            lastDay: "[GÃ«schter um] LT",
            lastWeek: function () {
              switch (this.day()) {
                case 2:
                case 4:
                  return "[Leschten] dddd [um] LT";
                default:
                  return "[Leschte] dddd [um] LT";
              }
            },
          },
          relativeTime: {
            future: c,
            past: d,
            s: "e puer Sekonnen",
            m: b,
            mm: "%d Minutten",
            h: b,
            hh: "%d Stonnen",
            d: b,
            dd: "%d Deeg",
            M: b,
            MM: "%d MÃ©int",
            y: b,
            yy: "%d Joer",
          },
          ordinal: "%d.",
          week: { dow: 1, doy: 4 },
        });
      }),
      (function (a) {
        a(tb);
      })(function (a) {
        function b(a, b, c, d) {
          return b
            ? "kelios sekundÄ—s"
            : d
            ? "keliÅ³ sekundÅ¾iÅ³"
            : "kelias sekundes";
        }
        function c(a, b, c, d) {
          return b ? e(c)[0] : d ? e(c)[1] : e(c)[2];
        }
        function d(a) {
          return a % 10 === 0 || (a > 10 && 20 > a);
        }
        function e(a) {
          return h[a].split("_");
        }
        function f(a, b, f, g) {
          var h = a + " ";
          return 1 === a
            ? h + c(a, b, f[0], g)
            : b
            ? h + (d(a) ? e(f)[1] : e(f)[0])
            : g
            ? h + e(f)[1]
            : h + (d(a) ? e(f)[1] : e(f)[2]);
        }
        function g(a, b) {
          var c = -1 === b.indexOf("dddd HH:mm"),
            d = i[a.day()];
          return c ? d : d.substring(0, d.length - 2) + "Ä¯";
        }
        var h = {
            m: "minutÄ—_minutÄ—s_minutÄ™",
            mm: "minutÄ—s_minuÄiÅ³_minutes",
            h: "valanda_valandos_valandÄ…",
            hh: "valandos_valandÅ³_valandas",
            d: "diena_dienos_dienÄ…",
            dd: "dienos_dienÅ³_dienas",
            M: "mÄ—nuo_mÄ—nesio_mÄ—nesÄ¯",
            MM: "mÄ—nesiai_mÄ—nesiÅ³_mÄ—nesius",
            y: "metai_metÅ³_metus",
            yy: "metai_metÅ³_metus",
          },
          i =
            "sekmadienis_pirmadienis_antradienis_treÄiadienis_ketvirtadienis_penktadienis_Å¡eÅ¡tadienis".split(
              "_"
            );
        return a.defineLocale("lt", {
          months:
            "sausio_vasario_kovo_balandÅ¾io_geguÅ¾Ä—s_birÅ¾elio_liepos_rugpjÅ«Äio_rugsÄ—jo_spalio_lapkriÄio_gruodÅ¾io".split(
              "_"
            ),
          monthsShort: "sau_vas_kov_bal_geg_bir_lie_rgp_rgs_spa_lap_grd".split(
            "_"
          ),
          weekdays: g,
          weekdaysShort: "Sek_Pir_Ant_Tre_Ket_Pen_Å eÅ¡".split("_"),
          weekdaysMin: "S_P_A_T_K_Pn_Å ".split("_"),
          longDateFormat: {
            LT: "HH:mm",
            L: "YYYY-MM-DD",
            LL: "YYYY [m.] MMMM D [d.]",
            LLL: "YYYY [m.] MMMM D [d.], LT [val.]",
            LLLL: "YYYY [m.] MMMM D [d.], dddd, LT [val.]",
            l: "YYYY-MM-DD",
            ll: "YYYY [m.] MMMM D [d.]",
            lll: "YYYY [m.] MMMM D [d.], LT [val.]",
            llll: "YYYY [m.] MMMM D [d.], ddd, LT [val.]",
          },
          calendar: {
            sameDay: "[Å iandien] LT",
            nextDay: "[Rytoj] LT",
            nextWeek: "dddd LT",
            lastDay: "[Vakar] LT",
            lastWeek: "[PraÄ—jusÄ¯] dddd LT",
            sameElse: "L",
          },
          relativeTime: {
            future: "po %s",
            past: "prieÅ¡ %s",
            s: b,
            m: c,
            mm: f,
            h: c,
            hh: f,
            d: c,
            dd: f,
            M: c,
            MM: f,
            y: c,
            yy: f,
          },
          ordinal: function (a) {
            return a + "-oji";
          },
          week: { dow: 1, doy: 4 },
        });
      }),
      (function (a) {
        a(tb);
      })(function (a) {
        function b(a, b, c) {
          var d = a.split("_");
          return c
            ? b % 10 === 1 && 11 !== b
              ? d[2]
              : d[3]
            : b % 10 === 1 && 11 !== b
            ? d[0]
            : d[1];
        }
        function c(a, c, e) {
          return a + " " + b(d[e], a, c);
        }
        var d = {
          mm: "minÅ«ti_minÅ«tes_minÅ«te_minÅ«tes",
          hh: "stundu_stundas_stunda_stundas",
          dd: "dienu_dienas_diena_dienas",
          MM: "mÄ“nesi_mÄ“neÅ¡us_mÄ“nesis_mÄ“neÅ¡i",
          yy: "gadu_gadus_gads_gadi",
        };
        return a.defineLocale("lv", {
          months:
            "janvÄris_februÄris_marts_aprÄ«lis_maijs_jÅ«nijs_jÅ«lijs_augusts_septembris_oktobris_novembris_decembris".split(
              "_"
            ),
          monthsShort:
            "jan_feb_mar_apr_mai_jÅ«n_jÅ«l_aug_sep_okt_nov_dec".split("_"),
          weekdays:
            "svÄ“tdiena_pirmdiena_otrdiena_treÅ¡diena_ceturtdiena_piektdiena_sestdiena".split(
              "_"
            ),
          weekdaysShort: "Sv_P_O_T_C_Pk_S".split("_"),
          weekdaysMin: "Sv_P_O_T_C_Pk_S".split("_"),
          longDateFormat: {
            LT: "HH:mm",
            L: "DD.MM.YYYY",
            LL: "YYYY. [gada] D. MMMM",
            LLL: "YYYY. [gada] D. MMMM, LT",
            LLLL: "YYYY. [gada] D. MMMM, dddd, LT",
          },
          calendar: {
            sameDay: "[Å odien pulksten] LT",
            nextDay: "[RÄ«t pulksten] LT",
            nextWeek: "dddd [pulksten] LT",
            lastDay: "[Vakar pulksten] LT",
            lastWeek: "[PagÄjuÅ¡Ä] dddd [pulksten] LT",
            sameElse: "L",
          },
          relativeTime: {
            future: "%s vÄ“lÄk",
            past: "%s agrÄk",
            s: "daÅ¾as sekundes",
            m: "minÅ«ti",
            mm: c,
            h: "stundu",
            hh: c,
            d: "dienu",
            dd: c,
            M: "mÄ“nesi",
            MM: c,
            y: "gadu",
            yy: c,
          },
          ordinal: "%d.",
          week: { dow: 1, doy: 4 },
        });
      }),
      (function (a) {
        a(tb);
      })(function (a) {
        return a.defineLocale("mk", {
          months:
            "Ñ˜Ð°Ð½ÑƒÐ°Ñ€Ð¸_Ñ„ÐµÐ²Ñ€ÑƒÐ°Ñ€Ð¸_Ð¼Ð°Ñ€Ñ‚_Ð°Ð¿Ñ€Ð¸Ð»_Ð¼Ð°Ñ˜_Ñ˜ÑƒÐ½Ð¸_Ñ˜ÑƒÐ»Ð¸_Ð°Ð²Ð³ÑƒÑÑ‚_ÑÐµÐ¿Ñ‚ÐµÐ¼Ð²Ñ€Ð¸_Ð¾ÐºÑ‚Ð¾Ð¼Ð²Ñ€Ð¸_Ð½Ð¾ÐµÐ¼Ð²Ñ€Ð¸_Ð´ÐµÐºÐµÐ¼Ð²Ñ€Ð¸".split(
              "_"
            ),
          monthsShort:
            "Ñ˜Ð°Ð½_Ñ„ÐµÐ²_Ð¼Ð°Ñ€_Ð°Ð¿Ñ€_Ð¼Ð°Ñ˜_Ñ˜ÑƒÐ½_Ñ˜ÑƒÐ»_Ð°Ð²Ð³_ÑÐµÐ¿_Ð¾ÐºÑ‚_Ð½Ð¾Ðµ_Ð´ÐµÐº".split(
              "_"
            ),
          weekdays:
            "Ð½ÐµÐ´ÐµÐ»Ð°_Ð¿Ð¾Ð½ÐµÐ´ÐµÐ»Ð½Ð¸Ðº_Ð²Ñ‚Ð¾Ñ€Ð½Ð¸Ðº_ÑÑ€ÐµÐ´Ð°_Ñ‡ÐµÑ‚Ð²Ñ€Ñ‚Ð¾Ðº_Ð¿ÐµÑ‚Ð¾Ðº_ÑÐ°Ð±Ð¾Ñ‚Ð°".split(
              "_"
            ),
          weekdaysShort: "Ð½ÐµÐ´_Ð¿Ð¾Ð½_Ð²Ñ‚Ð¾_ÑÑ€Ðµ_Ñ‡ÐµÑ‚_Ð¿ÐµÑ‚_ÑÐ°Ð±".split(
            "_"
          ),
          weekdaysMin: "Ð½e_Ð¿o_Ð²Ñ‚_ÑÑ€_Ñ‡Ðµ_Ð¿Ðµ_Ña".split("_"),
          longDateFormat: {
            LT: "H:mm",
            L: "D.MM.YYYY",
            LL: "D MMMM YYYY",
            LLL: "D MMMM YYYY LT",
            LLLL: "dddd, D MMMM YYYY LT",
          },
          calendar: {
            sameDay: "[Ð”ÐµÐ½ÐµÑ Ð²Ð¾] LT",
            nextDay: "[Ð£Ñ‚Ñ€Ðµ Ð²Ð¾] LT",
            nextWeek: "dddd [Ð²Ð¾] LT",
            lastDay: "[Ð’Ñ‡ÐµÑ€Ð° Ð²Ð¾] LT",
            lastWeek: function () {
              switch (this.day()) {
                case 0:
                case 3:
                case 6:
                  return "[Ð’Ð¾ Ð¸Ð·Ð¼Ð¸Ð½Ð°Ñ‚Ð°Ñ‚Ð°] dddd [Ð²Ð¾] LT";
                case 1:
                case 2:
                case 4:
                case 5:
                  return "[Ð’Ð¾ Ð¸Ð·Ð¼Ð¸Ð½Ð°Ñ‚Ð¸Ð¾Ñ‚] dddd [Ð²Ð¾] LT";
              }
            },
            sameElse: "L",
          },
          relativeTime: {
            future: "Ð¿Ð¾ÑÐ»Ðµ %s",
            past: "Ð¿Ñ€ÐµÐ´ %s",
            s: "Ð½ÐµÐºÐ¾Ð»ÐºÑƒ ÑÐµÐºÑƒÐ½Ð´Ð¸",
            m: "Ð¼Ð¸Ð½ÑƒÑ‚Ð°",
            mm: "%d Ð¼Ð¸Ð½ÑƒÑ‚Ð¸",
            h: "Ñ‡Ð°Ñ",
            hh: "%d Ñ‡Ð°ÑÐ°",
            d: "Ð´ÐµÐ½",
            dd: "%d Ð´ÐµÐ½Ð°",
            M: "Ð¼ÐµÑÐµÑ†",
            MM: "%d Ð¼ÐµÑÐµÑ†Ð¸",
            y: "Ð³Ð¾Ð´Ð¸Ð½Ð°",
            yy: "%d Ð³Ð¾Ð´Ð¸Ð½Ð¸",
          },
          ordinal: function (a) {
            var b = a % 10,
              c = a % 100;
            return 0 === a
              ? a + "-ÐµÐ²"
              : 0 === c
              ? a + "-ÐµÐ½"
              : c > 10 && 20 > c
              ? a + "-Ñ‚Ð¸"
              : 1 === b
              ? a + "-Ð²Ð¸"
              : 2 === b
              ? a + "-Ñ€Ð¸"
              : 7 === b || 8 === b
              ? a + "-Ð¼Ð¸"
              : a + "-Ñ‚Ð¸";
          },
          week: { dow: 1, doy: 7 },
        });
      }),
      (function (a) {
        a(tb);
      })(function (a) {
        return a.defineLocale("ml", {
          months:
            "à´œà´¨àµà´µà´°à´¿_à´«àµ†à´¬àµà´°àµà´µà´°à´¿_à´®à´¾àµ¼à´šàµà´šàµ_à´à´ªàµà´°à´¿àµ½_à´®àµ‡à´¯àµ_à´œàµ‚àµº_à´œàµ‚à´²àµˆ_à´“à´—à´¸àµà´±àµà´±àµ_à´¸àµ†à´ªàµà´±àµà´±à´‚à´¬àµ¼_à´’à´•àµà´Ÿàµ‹à´¬àµ¼_à´¨à´µà´‚à´¬àµ¼_à´¡à´¿à´¸à´‚à´¬àµ¼".split(
              "_"
            ),
          monthsShort:
            "à´œà´¨àµ._à´«àµ†à´¬àµà´°àµ._à´®à´¾àµ¼._à´à´ªàµà´°à´¿._à´®àµ‡à´¯àµ_à´œàµ‚àµº_à´œàµ‚à´²àµˆ._à´“à´—._à´¸àµ†à´ªàµà´±àµà´±._à´’à´•àµà´Ÿàµ‹._à´¨à´µà´‚._à´¡à´¿à´¸à´‚.".split(
              "_"
            ),
          weekdays:
            "à´žà´¾à´¯à´±à´¾à´´àµà´š_à´¤à´¿à´™àµà´•à´³à´¾à´´àµà´š_à´šàµŠà´µàµà´µà´¾à´´àµà´š_à´¬àµà´§à´¨à´¾à´´àµà´š_à´µàµà´¯à´¾à´´à´¾à´´àµà´š_à´µàµ†à´³àµà´³à´¿à´¯à´¾à´´àµà´š_à´¶à´¨à´¿à´¯à´¾à´´àµà´š".split(
              "_"
            ),
          weekdaysShort:
            "à´žà´¾à´¯àµ¼_à´¤à´¿à´™àµà´•àµ¾_à´šàµŠà´µàµà´µ_à´¬àµà´§àµ»_à´µàµà´¯à´¾à´´à´‚_à´µàµ†à´³àµà´³à´¿_à´¶à´¨à´¿".split(
              "_"
            ),
          weekdaysMin:
            "à´žà´¾_à´¤à´¿_à´šàµŠ_à´¬àµ_à´µàµà´¯à´¾_à´µàµ†_à´¶".split("_"),
          longDateFormat: {
            LT: "A h:mm -à´¨àµ",
            L: "DD/MM/YYYY",
            LL: "D MMMM YYYY",
            LLL: "D MMMM YYYY, LT",
            LLLL: "dddd, D MMMM YYYY, LT",
          },
          calendar: {
            sameDay: "[à´‡à´¨àµà´¨àµ] LT",
            nextDay: "[à´¨à´¾à´³àµ†] LT",
            nextWeek: "dddd, LT",
            lastDay: "[à´‡à´¨àµà´¨à´²àµ†] LT",
            lastWeek: "[à´•à´´à´¿à´žàµà´ž] dddd, LT",
            sameElse: "L",
          },
          relativeTime: {
            future: "%s à´•à´´à´¿à´žàµà´žàµ",
            past: "%s à´®àµàµ»à´ªàµ",
            s: "à´…àµ½à´ª à´¨à´¿à´®à´¿à´·à´™àµà´™àµ¾",
            m: "à´’à´°àµ à´®à´¿à´¨à´¿à´±àµà´±àµ",
            mm: "%d à´®à´¿à´¨à´¿à´±àµà´±àµ",
            h: "à´’à´°àµ à´®à´£à´¿à´•àµà´•àµ‚àµ¼",
            hh: "%d à´®à´£à´¿à´•àµà´•àµ‚àµ¼",
            d: "à´’à´°àµ à´¦à´¿à´µà´¸à´‚",
            dd: "%d à´¦à´¿à´µà´¸à´‚",
            M: "à´’à´°àµ à´®à´¾à´¸à´‚",
            MM: "%d à´®à´¾à´¸à´‚",
            y: "à´’à´°àµ à´µàµ¼à´·à´‚",
            yy: "%d à´µàµ¼à´·à´‚",
          },
          meridiem: function (a) {
            return 4 > a
              ? "à´°à´¾à´¤àµà´°à´¿"
              : 12 > a
              ? "à´°à´¾à´µà´¿à´²àµ†"
              : 17 > a
              ? "à´‰à´šàµà´š à´•à´´à´¿à´žàµà´žàµ"
              : 20 > a
              ? "à´µàµˆà´•àµà´¨àµà´¨àµ‡à´°à´‚"
              : "à´°à´¾à´¤àµà´°à´¿";
          },
        });
      }),
      (function (a) {
        a(tb);
      })(function (a) {
        var b = {
            1: "à¥§",
            2: "à¥¨",
            3: "à¥©",
            4: "à¥ª",
            5: "à¥«",
            6: "à¥¬",
            7: "à¥­",
            8: "à¥®",
            9: "à¥¯",
            0: "à¥¦",
          },
          c = {
            "à¥§": "1",
            "à¥¨": "2",
            "à¥©": "3",
            "à¥ª": "4",
            "à¥«": "5",
            "à¥¬": "6",
            "à¥­": "7",
            "à¥®": "8",
            "à¥¯": "9",
            "à¥¦": "0",
          };
        return a.defineLocale("mr", {
          months:
            "à¤œà¤¾à¤¨à¥‡à¤µà¤¾à¤°à¥€_à¤«à¥‡à¤¬à¥à¤°à¥à¤µà¤¾à¤°à¥€_à¤®à¤¾à¤°à¥à¤š_à¤à¤ªà¥à¤°à¤¿à¤²_à¤®à¥‡_à¤œà¥‚à¤¨_à¤œà¥à¤²à¥ˆ_à¤‘à¤—à¤¸à¥à¤Ÿ_à¤¸à¤ªà¥à¤Ÿà¥‡à¤‚à¤¬à¤°_à¤‘à¤•à¥à¤Ÿà¥‹à¤¬à¤°_à¤¨à¥‹à¤µà¥à¤¹à¥‡à¤‚à¤¬à¤°_à¤¡à¤¿à¤¸à¥‡à¤‚à¤¬à¤°".split(
              "_"
            ),
          monthsShort:
            "à¤œà¤¾à¤¨à¥‡._à¤«à¥‡à¤¬à¥à¤°à¥._à¤®à¤¾à¤°à¥à¤š._à¤à¤ªà¥à¤°à¤¿._à¤®à¥‡._à¤œà¥‚à¤¨._à¤œà¥à¤²à¥ˆ._à¤‘à¤—._à¤¸à¤ªà¥à¤Ÿà¥‡à¤‚._à¤‘à¤•à¥à¤Ÿà¥‹._à¤¨à¥‹à¤µà¥à¤¹à¥‡à¤‚._à¤¡à¤¿à¤¸à¥‡à¤‚.".split(
              "_"
            ),
          weekdays:
            "à¤°à¤µà¤¿à¤µà¤¾à¤°_à¤¸à¥‹à¤®à¤µà¤¾à¤°_à¤®à¤‚à¤—à¤³à¤µà¤¾à¤°_à¤¬à¥à¤§à¤µà¤¾à¤°_à¤—à¥à¤°à¥‚à¤µà¤¾à¤°_à¤¶à¥à¤•à¥à¤°à¤µà¤¾à¤°_à¤¶à¤¨à¤¿à¤µà¤¾à¤°".split(
              "_"
            ),
          weekdaysShort:
            "à¤°à¤µà¤¿_à¤¸à¥‹à¤®_à¤®à¤‚à¤—à¤³_à¤¬à¥à¤§_à¤—à¥à¤°à¥‚_à¤¶à¥à¤•à¥à¤°_à¤¶à¤¨à¤¿".split(
              "_"
            ),
          weekdaysMin: "à¤°_à¤¸à¥‹_à¤®à¤‚_à¤¬à¥_à¤—à¥_à¤¶à¥_à¤¶".split("_"),
          longDateFormat: {
            LT: "A h:mm à¤µà¤¾à¤œà¤¤à¤¾",
            L: "DD/MM/YYYY",
            LL: "D MMMM YYYY",
            LLL: "D MMMM YYYY, LT",
            LLLL: "dddd, D MMMM YYYY, LT",
          },
          calendar: {
            sameDay: "[à¤†à¤œ] LT",
            nextDay: "[à¤‰à¤¦à¥à¤¯à¤¾] LT",
            nextWeek: "dddd, LT",
            lastDay: "[à¤•à¤¾à¤²] LT",
            lastWeek: "[à¤®à¤¾à¤—à¥€à¤²] dddd, LT",
            sameElse: "L",
          },
          relativeTime: {
            future: "%s à¤¨à¤‚à¤¤à¤°",
            past: "%s à¤ªà¥‚à¤°à¥à¤µà¥€",
            s: "à¤¸à¥‡à¤•à¤‚à¤¦",
            m: "à¤à¤• à¤®à¤¿à¤¨à¤¿à¤Ÿ",
            mm: "%d à¤®à¤¿à¤¨à¤¿à¤Ÿà¥‡",
            h: "à¤à¤• à¤¤à¤¾à¤¸",
            hh: "%d à¤¤à¤¾à¤¸",
            d: "à¤à¤• à¤¦à¤¿à¤µà¤¸",
            dd: "%d à¤¦à¤¿à¤µà¤¸",
            M: "à¤à¤• à¤®à¤¹à¤¿à¤¨à¤¾",
            MM: "%d à¤®à¤¹à¤¿à¤¨à¥‡",
            y: "à¤à¤• à¤µà¤°à¥à¤·",
            yy: "%d à¤µà¤°à¥à¤·à¥‡",
          },
          preparse: function (a) {
            return a.replace(/[à¥§à¥¨à¥©à¥ªà¥«à¥¬à¥­à¥®à¥¯à¥¦]/g, function (a) {
              return c[a];
            });
          },
          postformat: function (a) {
            return a.replace(/\d/g, function (a) {
              return b[a];
            });
          },
          meridiem: function (a) {
            return 4 > a
              ? "à¤°à¤¾à¤¤à¥à¤°à¥€"
              : 10 > a
              ? "à¤¸à¤•à¤¾à¤³à¥€"
              : 17 > a
              ? "à¤¦à¥à¤ªà¤¾à¤°à¥€"
              : 20 > a
              ? "à¤¸à¤¾à¤¯à¤‚à¤•à¤¾à¤³à¥€"
              : "à¤°à¤¾à¤¤à¥à¤°à¥€";
          },
          week: { dow: 0, doy: 6 },
        });
      }),
      (function (a) {
        a(tb);
      })(function (a) {
        return a.defineLocale("ms-my", {
          months:
            "Januari_Februari_Mac_April_Mei_Jun_Julai_Ogos_September_Oktober_November_Disember".split(
              "_"
            ),
          monthsShort: "Jan_Feb_Mac_Apr_Mei_Jun_Jul_Ogs_Sep_Okt_Nov_Dis".split(
            "_"
          ),
          weekdays: "Ahad_Isnin_Selasa_Rabu_Khamis_Jumaat_Sabtu".split("_"),
          weekdaysShort: "Ahd_Isn_Sel_Rab_Kha_Jum_Sab".split("_"),
          weekdaysMin: "Ah_Is_Sl_Rb_Km_Jm_Sb".split("_"),
          longDateFormat: {
            LT: "HH.mm",
            L: "DD/MM/YYYY",
            LL: "D MMMM YYYY",
            LLL: "D MMMM YYYY [pukul] LT",
            LLLL: "dddd, D MMMM YYYY [pukul] LT",
          },
          meridiem: function (a) {
            return 11 > a
              ? "pagi"
              : 15 > a
              ? "tengahari"
              : 19 > a
              ? "petang"
              : "malam";
          },
          calendar: {
            sameDay: "[Hari ini pukul] LT",
            nextDay: "[Esok pukul] LT",
            nextWeek: "dddd [pukul] LT",
            lastDay: "[Kelmarin pukul] LT",
            lastWeek: "dddd [lepas pukul] LT",
            sameElse: "L",
          },
          relativeTime: {
            future: "dalam %s",
            past: "%s yang lepas",
            s: "beberapa saat",
            m: "seminit",
            mm: "%d minit",
            h: "sejam",
            hh: "%d jam",
            d: "sehari",
            dd: "%d hari",
            M: "sebulan",
            MM: "%d bulan",
            y: "setahun",
            yy: "%d tahun",
          },
          week: { dow: 1, doy: 7 },
        });
      }),
      (function (a) {
        a(tb);
      })(function (a) {
        var b = {
            1: "á",
            2: "á‚",
            3: "áƒ",
            4: "á„",
            5: "á…",
            6: "á†",
            7: "á‡",
            8: "áˆ",
            9: "á‰",
            0: "á€",
          },
          c = {
            "á": "1",
            "á‚": "2",
            "áƒ": "3",
            "á„": "4",
            "á…": "5",
            "á†": "6",
            "á‡": "7",
            "áˆ": "8",
            "á‰": "9",
            "á€": "0",
          };
        return a.defineLocale("my", {
          months:
            "á€‡á€”á€ºá€”á€á€«á€›á€®_á€–á€±á€–á€±á€¬á€ºá€á€«á€›á€®_á€™á€á€º_á€§á€•á€¼á€®_á€™á€±_á€‡á€½á€”á€º_á€‡á€°á€œá€­á€¯á€„á€º_á€žá€¼á€‚á€¯á€á€º_á€…á€€á€ºá€á€„á€ºá€˜á€¬_á€¡á€±á€¬á€€á€ºá€á€­á€¯á€˜á€¬_á€”á€­á€¯á€á€„á€ºá€˜á€¬_á€’á€®á€‡á€„á€ºá€˜á€¬".split(
              "_"
            ),
          monthsShort:
            "á€‡á€”á€º_á€–á€±_á€™á€á€º_á€•á€¼á€®_á€™á€±_á€‡á€½á€”á€º_á€œá€­á€¯á€„á€º_á€žá€¼_á€…á€€á€º_á€¡á€±á€¬á€€á€º_á€”á€­á€¯_á€’á€®".split(
              "_"
            ),
          weekdays:
            "á€á€”á€„á€ºá€¹á€‚á€”á€½á€±_á€á€”á€„á€ºá€¹á€œá€¬_á€¡á€„á€ºá€¹á€‚á€«_á€—á€¯á€’á€¹á€“á€Ÿá€°á€¸_á€€á€¼á€¬á€žá€•á€á€±á€¸_á€žá€±á€¬á€€á€¼á€¬_á€…á€”á€±".split(
              "_"
            ),
          weekdaysShort:
            "á€”á€½á€±_á€œá€¬_á€„á€ºá€¹á€‚á€«_á€Ÿá€°á€¸_á€€á€¼á€¬_á€žá€±á€¬_á€”á€±".split(
              "_"
            ),
          weekdaysMin:
            "á€”á€½á€±_á€œá€¬_á€„á€ºá€¹á€‚á€«_á€Ÿá€°á€¸_á€€á€¼á€¬_á€žá€±á€¬_á€”á€±".split(
              "_"
            ),
          longDateFormat: {
            LT: "HH:mm",
            L: "DD/MM/YYYY",
            LL: "D MMMM YYYY",
            LLL: "D MMMM YYYY LT",
            LLLL: "dddd D MMMM YYYY LT",
          },
          calendar: {
            sameDay: "[á€šá€”á€±.] LT [á€™á€¾á€¬]",
            nextDay: "[á€™á€”á€€á€ºá€–á€¼á€”á€º] LT [á€™á€¾á€¬]",
            nextWeek: "dddd LT [á€™á€¾á€¬]",
            lastDay: "[á€™á€”á€±.á€€] LT [á€™á€¾á€¬]",
            lastWeek: "[á€•á€¼á€®á€¸á€á€²á€·á€žá€±á€¬] dddd LT [á€™á€¾á€¬]",
            sameElse: "L",
          },
          relativeTime: {
            future: "á€œá€¬á€™á€Šá€ºá€· %s á€™á€¾á€¬",
            past: "á€œá€½á€”á€ºá€á€²á€·á€žá€±á€¬ %s á€€",
            s: "á€…á€€á€¹á€€á€”á€º.á€¡á€”á€Šá€ºá€¸á€„á€šá€º",
            m: "á€á€…á€ºá€™á€­á€”á€…á€º",
            mm: "%d á€™á€­á€”á€…á€º",
            h: "á€á€…á€ºá€”á€¬á€›á€®",
            hh: "%d á€”á€¬á€›á€®",
            d: "á€á€…á€ºá€›á€€á€º",
            dd: "%d á€›á€€á€º",
            M: "á€á€…á€ºá€œ",
            MM: "%d á€œ",
            y: "á€á€…á€ºá€”á€¾á€…á€º",
            yy: "%d á€”á€¾á€…á€º",
          },
          preparse: function (a) {
            return a.replace(/[áá‚áƒá„á…á†á‡áˆá‰á€]/g, function (a) {
              return c[a];
            });
          },
          postformat: function (a) {
            return a.replace(/\d/g, function (a) {
              return b[a];
            });
          },
          week: { dow: 1, doy: 4 },
        });
      }),
      (function (a) {
        a(tb);
      })(function (a) {
        return a.defineLocale("nb", {
          months:
            "januar_februar_mars_april_mai_juni_juli_august_september_oktober_november_desember".split(
              "_"
            ),
          monthsShort: "jan_feb_mar_apr_mai_jun_jul_aug_sep_okt_nov_des".split(
            "_"
          ),
          weekdays:
            "sÃ¸ndag_mandag_tirsdag_onsdag_torsdag_fredag_lÃ¸rdag".split("_"),
          weekdaysShort: "sÃ¸n_man_tirs_ons_tors_fre_lÃ¸r".split("_"),
          weekdaysMin: "sÃ¸_ma_ti_on_to_fr_lÃ¸".split("_"),
          longDateFormat: {
            LT: "H.mm",
            L: "DD.MM.YYYY",
            LL: "D. MMMM YYYY",
            LLL: "D. MMMM YYYY [kl.] LT",
            LLLL: "dddd D. MMMM YYYY [kl.] LT",
          },
          calendar: {
            sameDay: "[i dag kl.] LT",
            nextDay: "[i morgen kl.] LT",
            nextWeek: "dddd [kl.] LT",
            lastDay: "[i gÃ¥r kl.] LT",
            lastWeek: "[forrige] dddd [kl.] LT",
            sameElse: "L",
          },
          relativeTime: {
            future: "om %s",
            past: "for %s siden",
            s: "noen sekunder",
            m: "ett minutt",
            mm: "%d minutter",
            h: "en time",
            hh: "%d timer",
            d: "en dag",
            dd: "%d dager",
            M: "en mÃ¥ned",
            MM: "%d mÃ¥neder",
            y: "ett Ã¥r",
            yy: "%d Ã¥r",
          },
          ordinal: "%d.",
          week: { dow: 1, doy: 4 },
        });
      }),
      (function (a) {
        a(tb);
      })(function (a) {
        var b = {
            1: "à¥§",
            2: "à¥¨",
            3: "à¥©",
            4: "à¥ª",
            5: "à¥«",
            6: "à¥¬",
            7: "à¥­",
            8: "à¥®",
            9: "à¥¯",
            0: "à¥¦",
          },
          c = {
            "à¥§": "1",
            "à¥¨": "2",
            "à¥©": "3",
            "à¥ª": "4",
            "à¥«": "5",
            "à¥¬": "6",
            "à¥­": "7",
            "à¥®": "8",
            "à¥¯": "9",
            "à¥¦": "0",
          };
        return a.defineLocale("ne", {
          months:
            "à¤œà¤¨à¤µà¤°à¥€_à¤«à¥‡à¤¬à¥à¤°à¥à¤µà¤°à¥€_à¤®à¤¾à¤°à¥à¤š_à¤…à¤ªà¥à¤°à¤¿à¤²_à¤®à¤ˆ_à¤œà¥à¤¨_à¤œà¥à¤²à¤¾à¤ˆ_à¤…à¤—à¤·à¥à¤Ÿ_à¤¸à¥‡à¤ªà¥à¤Ÿà¥‡à¤®à¥à¤¬à¤°_à¤…à¤•à¥à¤Ÿà¥‹à¤¬à¤°_à¤¨à¥‹à¤­à¥‡à¤®à¥à¤¬à¤°_à¤¡à¤¿à¤¸à¥‡à¤®à¥à¤¬à¤°".split(
              "_"
            ),
          monthsShort:
            "à¤œà¤¨._à¤«à¥‡à¤¬à¥à¤°à¥._à¤®à¤¾à¤°à¥à¤š_à¤…à¤ªà¥à¤°à¤¿._à¤®à¤ˆ_à¤œà¥à¤¨_à¤œà¥à¤²à¤¾à¤ˆ._à¤…à¤—._à¤¸à¥‡à¤ªà¥à¤Ÿ._à¤…à¤•à¥à¤Ÿà¥‹._à¤¨à¥‹à¤­à¥‡._à¤¡à¤¿à¤¸à¥‡.".split(
              "_"
            ),
          weekdays:
            "à¤†à¤‡à¤¤à¤¬à¤¾à¤°_à¤¸à¥‹à¤®à¤¬à¤¾à¤°_à¤®à¤™à¥à¤—à¤²à¤¬à¤¾à¤°_à¤¬à¥à¤§à¤¬à¤¾à¤°_à¤¬à¤¿à¤¹à¤¿à¤¬à¤¾à¤°_à¤¶à¥à¤•à¥à¤°à¤¬à¤¾à¤°_à¤¶à¤¨à¤¿à¤¬à¤¾à¤°".split(
              "_"
            ),
          weekdaysShort:
            "à¤†à¤‡à¤¤._à¤¸à¥‹à¤®._à¤®à¤™à¥à¤—à¤²._à¤¬à¥à¤§._à¤¬à¤¿à¤¹à¤¿._à¤¶à¥à¤•à¥à¤°._à¤¶à¤¨à¤¿.".split(
              "_"
            ),
          weekdaysMin:
            "à¤†à¤‡._à¤¸à¥‹._à¤®à¤™à¥_à¤¬à¥._à¤¬à¤¿._à¤¶à¥._à¤¶.".split("_"),
          longDateFormat: {
            LT: "Aà¤•à¥‹ h:mm à¤¬à¤œà¥‡",
            L: "DD/MM/YYYY",
            LL: "D MMMM YYYY",
            LLL: "D MMMM YYYY, LT",
            LLLL: "dddd, D MMMM YYYY, LT",
          },
          preparse: function (a) {
            return a.replace(/[à¥§à¥¨à¥©à¥ªà¥«à¥¬à¥­à¥®à¥¯à¥¦]/g, function (a) {
              return c[a];
            });
          },
          postformat: function (a) {
            return a.replace(/\d/g, function (a) {
              return b[a];
            });
          },
          meridiem: function (a) {
            return 3 > a
              ? "à¤°à¤¾à¤¤à¥€"
              : 10 > a
              ? "à¤¬à¤¿à¤¹à¤¾à¤¨"
              : 15 > a
              ? "à¤¦à¤¿à¤‰à¤à¤¸à¥‹"
              : 18 > a
              ? "à¤¬à¥‡à¤²à¥à¤•à¤¾"
              : 20 > a
              ? "à¤¸à¤¾à¤à¤"
              : "à¤°à¤¾à¤¤à¥€";
          },
          calendar: {
            sameDay: "[à¤†à¤œ] LT",
            nextDay: "[à¤­à¥‹à¤²à¥€] LT",
            nextWeek: "[à¤†à¤‰à¤à¤¦à¥‹] dddd[,] LT",
            lastDay: "[à¤¹à¤¿à¤œà¥‹] LT",
            lastWeek: "[à¤—à¤à¤•à¥‹] dddd[,] LT",
            sameElse: "L",
          },
          relativeTime: {
            future: "%sà¤®à¤¾",
            past: "%s à¤…à¤—à¤¾à¤¡à¥€",
            s: "à¤•à¥‡à¤¹à¥€ à¤¸à¤®à¤¯",
            m: "à¤à¤• à¤®à¤¿à¤¨à¥‡à¤Ÿ",
            mm: "%d à¤®à¤¿à¤¨à¥‡à¤Ÿ",
            h: "à¤à¤• à¤˜à¤£à¥à¤Ÿà¤¾",
            hh: "%d à¤˜à¤£à¥à¤Ÿà¤¾",
            d: "à¤à¤• à¤¦à¤¿à¤¨",
            dd: "%d à¤¦à¤¿à¤¨",
            M: "à¤à¤• à¤®à¤¹à¤¿à¤¨à¤¾",
            MM: "%d à¤®à¤¹à¤¿à¤¨à¤¾",
            y: "à¤à¤• à¤¬à¤°à¥à¤·",
            yy: "%d à¤¬à¤°à¥à¤·",
          },
          week: { dow: 1, doy: 7 },
        });
      }),
      (function (a) {
        a(tb);
      })(function (a) {
        var b =
            "jan._feb._mrt._apr._mei_jun._jul._aug._sep._okt._nov._dec.".split(
              "_"
            ),
          c = "jan_feb_mrt_apr_mei_jun_jul_aug_sep_okt_nov_dec".split("_");
        return a.defineLocale("nl", {
          months:
            "januari_februari_maart_april_mei_juni_juli_augustus_september_oktober_november_december".split(
              "_"
            ),
          monthsShort: function (a, d) {
            return /-MMM-/.test(d) ? c[a.month()] : b[a.month()];
          },
          weekdays:
            "zondag_maandag_dinsdag_woensdag_donderdag_vrijdag_zaterdag".split(
              "_"
            ),
          weekdaysShort: "zo._ma._di._wo._do._vr._za.".split("_"),
          weekdaysMin: "Zo_Ma_Di_Wo_Do_Vr_Za".split("_"),
          longDateFormat: {
            LT: "HH:mm",
            L: "DD-MM-YYYY",
            LL: "D MMMM YYYY",
            LLL: "D MMMM YYYY LT",
            LLLL: "dddd D MMMM YYYY LT",
          },
          calendar: {
            sameDay: "[vandaag om] LT",
            nextDay: "[morgen om] LT",
            nextWeek: "dddd [om] LT",
            lastDay: "[gisteren om] LT",
            lastWeek: "[afgelopen] dddd [om] LT",
            sameElse: "L",
          },
          relativeTime: {
            future: "over %s",
            past: "%s geleden",
            s: "een paar seconden",
            m: "Ã©Ã©n minuut",
            mm: "%d minuten",
            h: "Ã©Ã©n uur",
            hh: "%d uur",
            d: "Ã©Ã©n dag",
            dd: "%d dagen",
            M: "Ã©Ã©n maand",
            MM: "%d maanden",
            y: "Ã©Ã©n jaar",
            yy: "%d jaar",
          },
          ordinal: function (a) {
            return a + (1 === a || 8 === a || a >= 20 ? "ste" : "de");
          },
          week: { dow: 1, doy: 4 },
        });
      }),
      (function (a) {
        a(tb);
      })(function (a) {
        return a.defineLocale("nn", {
          months:
            "januar_februar_mars_april_mai_juni_juli_august_september_oktober_november_desember".split(
              "_"
            ),
          monthsShort: "jan_feb_mar_apr_mai_jun_jul_aug_sep_okt_nov_des".split(
            "_"
          ),
          weekdays: "sundag_mÃ¥ndag_tysdag_onsdag_torsdag_fredag_laurdag".split(
            "_"
          ),
          weekdaysShort: "sun_mÃ¥n_tys_ons_tor_fre_lau".split("_"),
          weekdaysMin: "su_mÃ¥_ty_on_to_fr_lÃ¸".split("_"),
          longDateFormat: {
            LT: "HH:mm",
            L: "DD.MM.YYYY",
            LL: "D MMMM YYYY",
            LLL: "D MMMM YYYY LT",
            LLLL: "dddd D MMMM YYYY LT",
          },
          calendar: {
            sameDay: "[I dag klokka] LT",
            nextDay: "[I morgon klokka] LT",
            nextWeek: "dddd [klokka] LT",
            lastDay: "[I gÃ¥r klokka] LT",
            lastWeek: "[FÃ¸regÃ¥ande] dddd [klokka] LT",
            sameElse: "L",
          },
          relativeTime: {
            future: "om %s",
            past: "for %s sidan",
            s: "nokre sekund",
            m: "eit minutt",
            mm: "%d minutt",
            h: "ein time",
            hh: "%d timar",
            d: "ein dag",
            dd: "%d dagar",
            M: "ein mÃ¥nad",
            MM: "%d mÃ¥nader",
            y: "eit Ã¥r",
            yy: "%d Ã¥r",
          },
          ordinal: "%d.",
          week: { dow: 1, doy: 4 },
        });
      }),
      (function (a) {
        a(tb);
      })(function (a) {
        function b(a) {
          return 5 > a % 10 && a % 10 > 1 && ~~(a / 10) % 10 !== 1;
        }
        function c(a, c, d) {
          var e = a + " ";
          switch (d) {
            case "m":
              return c ? "minuta" : "minutÄ™";
            case "mm":
              return e + (b(a) ? "minuty" : "minut");
            case "h":
              return c ? "godzina" : "godzinÄ™";
            case "hh":
              return e + (b(a) ? "godziny" : "godzin");
            case "MM":
              return e + (b(a) ? "miesiÄ…ce" : "miesiÄ™cy");
            case "yy":
              return e + (b(a) ? "lata" : "lat");
          }
        }
        var d =
            "styczeÅ„_luty_marzec_kwiecieÅ„_maj_czerwiec_lipiec_sierpieÅ„_wrzesieÅ„_paÅºdziernik_listopad_grudzieÅ„".split(
              "_"
            ),
          e =
            "stycznia_lutego_marca_kwietnia_maja_czerwca_lipca_sierpnia_wrzeÅ›nia_paÅºdziernika_listopada_grudnia".split(
              "_"
            );
        return a.defineLocale("pl", {
          months: function (a, b) {
            return /D MMMM/.test(b) ? e[a.month()] : d[a.month()];
          },
          monthsShort: "sty_lut_mar_kwi_maj_cze_lip_sie_wrz_paÅº_lis_gru".split(
            "_"
          ),
          weekdays:
            "niedziela_poniedziaÅ‚ek_wtorek_Å›roda_czwartek_piÄ…tek_sobota".split(
              "_"
            ),
          weekdaysShort: "nie_pon_wt_Å›r_czw_pt_sb".split("_"),
          weekdaysMin: "N_Pn_Wt_Åšr_Cz_Pt_So".split("_"),
          longDateFormat: {
            LT: "HH:mm",
            L: "DD.MM.YYYY",
            LL: "D MMMM YYYY",
            LLL: "D MMMM YYYY LT",
            LLLL: "dddd, D MMMM YYYY LT",
          },
          calendar: {
            sameDay: "[DziÅ› o] LT",
            nextDay: "[Jutro o] LT",
            nextWeek: "[W] dddd [o] LT",
            lastDay: "[Wczoraj o] LT",
            lastWeek: function () {
              switch (this.day()) {
                case 0:
                  return "[W zeszÅ‚Ä… niedzielÄ™ o] LT";
                case 3:
                  return "[W zeszÅ‚Ä… Å›rodÄ™ o] LT";
                case 6:
                  return "[W zeszÅ‚Ä… sobotÄ™ o] LT";
                default:
                  return "[W zeszÅ‚y] dddd [o] LT";
              }
            },
            sameElse: "L",
          },
          relativeTime: {
            future: "za %s",
            past: "%s temu",
            s: "kilka sekund",
            m: c,
            mm: c,
            h: c,
            hh: c,
            d: "1 dzieÅ„",
            dd: "%d dni",
            M: "miesiÄ…c",
            MM: c,
            y: "rok",
            yy: c,
          },
          ordinal: "%d.",
          week: { dow: 1, doy: 4 },
        });
      }),
      (function (a) {
        a(tb);
      })(function (a) {
        return a.defineLocale("pt-br", {
          months:
            "janeiro_fevereiro_marÃ§o_abril_maio_junho_julho_agosto_setembro_outubro_novembro_dezembro".split(
              "_"
            ),
          monthsShort: "jan_fev_mar_abr_mai_jun_jul_ago_set_out_nov_dez".split(
            "_"
          ),
          weekdays:
            "domingo_segunda-feira_terÃ§a-feira_quarta-feira_quinta-feira_sexta-feira_sÃ¡bado".split(
              "_"
            ),
          weekdaysShort: "dom_seg_ter_qua_qui_sex_sÃ¡b".split("_"),
          weekdaysMin: "dom_2Âª_3Âª_4Âª_5Âª_6Âª_sÃ¡b".split("_"),
          longDateFormat: {
            LT: "HH:mm",
            L: "DD/MM/YYYY",
            LL: "D [de] MMMM [de] YYYY",
            LLL: "D [de] MMMM [de] YYYY [Ã s] LT",
            LLLL: "dddd, D [de] MMMM [de] YYYY [Ã s] LT",
          },
          calendar: {
            sameDay: "[Hoje Ã s] LT",
            nextDay: "[AmanhÃ£ Ã s] LT",
            nextWeek: "dddd [Ã s] LT",
            lastDay: "[Ontem Ã s] LT",
            lastWeek: function () {
              return 0 === this.day() || 6 === this.day()
                ? "[Ãšltimo] dddd [Ã s] LT"
                : "[Ãšltima] dddd [Ã s] LT";
            },
            sameElse: "L",
          },
          relativeTime: {
            future: "em %s",
            past: "%s atrÃ¡s",
            s: "segundos",
            m: "um minuto",
            mm: "%d minutos",
            h: "uma hora",
            hh: "%d horas",
            d: "um dia",
            dd: "%d dias",
            M: "um mÃªs",
            MM: "%d meses",
            y: "um ano",
            yy: "%d anos",
          },
          ordinal: "%dÂº",
        });
      }),
      (function (a) {
        a(tb);
      })(function (a) {
        return a.defineLocale("pt", {
          months:
            "janeiro_fevereiro_marÃ§o_abril_maio_junho_julho_agosto_setembro_outubro_novembro_dezembro".split(
              "_"
            ),
          monthsShort: "jan_fev_mar_abr_mai_jun_jul_ago_set_out_nov_dez".split(
            "_"
          ),
          weekdays:
            "domingo_segunda-feira_terÃ§a-feira_quarta-feira_quinta-feira_sexta-feira_sÃ¡bado".split(
              "_"
            ),
          weekdaysShort: "dom_seg_ter_qua_qui_sex_sÃ¡b".split("_"),
          weekdaysMin: "dom_2Âª_3Âª_4Âª_5Âª_6Âª_sÃ¡b".split("_"),
          longDateFormat: {
            LT: "HH:mm",
            L: "DD/MM/YYYY",
            LL: "D [de] MMMM [de] YYYY",
            LLL: "D [de] MMMM [de] YYYY LT",
            LLLL: "dddd, D [de] MMMM [de] YYYY LT",
          },
          calendar: {
            sameDay: "[Hoje Ã s] LT",
            nextDay: "[AmanhÃ£ Ã s] LT",
            nextWeek: "dddd [Ã s] LT",
            lastDay: "[Ontem Ã s] LT",
            lastWeek: function () {
              return 0 === this.day() || 6 === this.day()
                ? "[Ãšltimo] dddd [Ã s] LT"
                : "[Ãšltima] dddd [Ã s] LT";
            },
            sameElse: "L",
          },
          relativeTime: {
            future: "em %s",
            past: "hÃ¡ %s",
            s: "segundos",
            m: "um minuto",
            mm: "%d minutos",
            h: "uma hora",
            hh: "%d horas",
            d: "um dia",
            dd: "%d dias",
            M: "um mÃªs",
            MM: "%d meses",
            y: "um ano",
            yy: "%d anos",
          },
          ordinal: "%dÂº",
          week: { dow: 1, doy: 4 },
        });
      }),
      (function (a) {
        a(tb);
      })(function (a) {
        function b(a, b, c) {
          var d = {
              mm: "minute",
              hh: "ore",
              dd: "zile",
              MM: "luni",
              yy: "ani",
            },
            e = " ";
          return (
            (a % 100 >= 20 || (a >= 100 && a % 100 === 0)) && (e = " de "),
            a + e + d[c]
          );
        }
        return a.defineLocale("ro", {
          months:
            "ianuarie_februarie_martie_aprilie_mai_iunie_iulie_august_septembrie_octombrie_noiembrie_decembrie".split(
              "_"
            ),
          monthsShort:
            "ian._febr._mart._apr._mai_iun._iul._aug._sept._oct._nov._dec.".split(
              "_"
            ),
          weekdays:
            "duminicÄƒ_luni_marÈ›i_miercuri_joi_vineri_sÃ¢mbÄƒtÄƒ".split("_"),
          weekdaysShort: "Dum_Lun_Mar_Mie_Joi_Vin_SÃ¢m".split("_"),
          weekdaysMin: "Du_Lu_Ma_Mi_Jo_Vi_SÃ¢".split("_"),
          longDateFormat: {
            LT: "H:mm",
            L: "DD.MM.YYYY",
            LL: "D MMMM YYYY",
            LLL: "D MMMM YYYY H:mm",
            LLLL: "dddd, D MMMM YYYY H:mm",
          },
          calendar: {
            sameDay: "[azi la] LT",
            nextDay: "[mÃ¢ine la] LT",
            nextWeek: "dddd [la] LT",
            lastDay: "[ieri la] LT",
            lastWeek: "[fosta] dddd [la] LT",
            sameElse: "L",
          },
          relativeTime: {
            future: "peste %s",
            past: "%s Ã®n urmÄƒ",
            s: "cÃ¢teva secunde",
            m: "un minut",
            mm: b,
            h: "o orÄƒ",
            hh: b,
            d: "o zi",
            dd: b,
            M: "o lunÄƒ",
            MM: b,
            y: "un an",
            yy: b,
          },
          week: { dow: 1, doy: 7 },
        });
      }),
      (function (a) {
        a(tb);
      })(function (a) {
        function b(a, b) {
          var c = a.split("_");
          return b % 10 === 1 && b % 100 !== 11
            ? c[0]
            : b % 10 >= 2 && 4 >= b % 10 && (10 > b % 100 || b % 100 >= 20)
            ? c[1]
            : c[2];
        }
        function c(a, c, d) {
          var e = {
            mm: c
              ? "Ð¼Ð¸Ð½ÑƒÑ‚Ð°_Ð¼Ð¸Ð½ÑƒÑ‚Ñ‹_Ð¼Ð¸Ð½ÑƒÑ‚"
              : "Ð¼Ð¸Ð½ÑƒÑ‚Ñƒ_Ð¼Ð¸Ð½ÑƒÑ‚Ñ‹_Ð¼Ð¸Ð½ÑƒÑ‚",
            hh: "Ñ‡Ð°Ñ_Ñ‡Ð°ÑÐ°_Ñ‡Ð°ÑÐ¾Ð²",
            dd: "Ð´ÐµÐ½ÑŒ_Ð´Ð½Ñ_Ð´Ð½ÐµÐ¹",
            MM: "Ð¼ÐµÑÑÑ†_Ð¼ÐµÑÑÑ†Ð°_Ð¼ÐµÑÑÑ†ÐµÐ²",
            yy: "Ð³Ð¾Ð´_Ð³Ð¾Ð´Ð°_Ð»ÐµÑ‚",
          };
          return "m" === d
            ? c
              ? "Ð¼Ð¸Ð½ÑƒÑ‚Ð°"
              : "Ð¼Ð¸Ð½ÑƒÑ‚Ñƒ"
            : a + " " + b(e[d], +a);
        }
        function d(a, b) {
          var c = {
              nominative:
                "ÑÐ½Ð²Ð°Ñ€ÑŒ_Ñ„ÐµÐ²Ñ€Ð°Ð»ÑŒ_Ð¼Ð°Ñ€Ñ‚_Ð°Ð¿Ñ€ÐµÐ»ÑŒ_Ð¼Ð°Ð¹_Ð¸ÑŽÐ½ÑŒ_Ð¸ÑŽÐ»ÑŒ_Ð°Ð²Ð³ÑƒÑÑ‚_ÑÐµÐ½Ñ‚ÑÐ±Ñ€ÑŒ_Ð¾ÐºÑ‚ÑÐ±Ñ€ÑŒ_Ð½Ð¾ÑÐ±Ñ€ÑŒ_Ð´ÐµÐºÐ°Ð±Ñ€ÑŒ".split(
                  "_"
                ),
              accusative:
                "ÑÐ½Ð²Ð°Ñ€Ñ_Ñ„ÐµÐ²Ñ€Ð°Ð»Ñ_Ð¼Ð°Ñ€Ñ‚Ð°_Ð°Ð¿Ñ€ÐµÐ»Ñ_Ð¼Ð°Ñ_Ð¸ÑŽÐ½Ñ_Ð¸ÑŽÐ»Ñ_Ð°Ð²Ð³ÑƒÑÑ‚Ð°_ÑÐµÐ½Ñ‚ÑÐ±Ñ€Ñ_Ð¾ÐºÑ‚ÑÐ±Ñ€Ñ_Ð½Ð¾ÑÐ±Ñ€Ñ_Ð´ÐµÐºÐ°Ð±Ñ€Ñ".split(
                  "_"
                ),
            },
            d = /D[oD]?(\[[^\[\]]*\]|\s+)+MMMM?/.test(b)
              ? "accusative"
              : "nominative";
          return c[d][a.month()];
        }
        function e(a, b) {
          var c = {
              nominative:
                "ÑÐ½Ð²_Ñ„ÐµÐ²_Ð¼Ð°Ñ€_Ð°Ð¿Ñ€_Ð¼Ð°Ð¹_Ð¸ÑŽÐ½ÑŒ_Ð¸ÑŽÐ»ÑŒ_Ð°Ð²Ð³_ÑÐµÐ½_Ð¾ÐºÑ‚_Ð½Ð¾Ñ_Ð´ÐµÐº".split(
                  "_"
                ),
              accusative:
                "ÑÐ½Ð²_Ñ„ÐµÐ²_Ð¼Ð°Ñ€_Ð°Ð¿Ñ€_Ð¼Ð°Ñ_Ð¸ÑŽÐ½Ñ_Ð¸ÑŽÐ»Ñ_Ð°Ð²Ð³_ÑÐµÐ½_Ð¾ÐºÑ‚_Ð½Ð¾Ñ_Ð´ÐµÐº".split(
                  "_"
                ),
            },
            d = /D[oD]?(\[[^\[\]]*\]|\s+)+MMMM?/.test(b)
              ? "accusative"
              : "nominative";
          return c[d][a.month()];
        }
        function f(a, b) {
          var c = {
              nominative:
                "Ð²Ð¾ÑÐºÑ€ÐµÑÐµÐ½ÑŒÐµ_Ð¿Ð¾Ð½ÐµÐ´ÐµÐ»ÑŒÐ½Ð¸Ðº_Ð²Ñ‚Ð¾Ñ€Ð½Ð¸Ðº_ÑÑ€ÐµÐ´Ð°_Ñ‡ÐµÑ‚Ð²ÐµÑ€Ð³_Ð¿ÑÑ‚Ð½Ð¸Ñ†Ð°_ÑÑƒÐ±Ð±Ð¾Ñ‚Ð°".split(
                  "_"
                ),
              accusative:
                "Ð²Ð¾ÑÐºÑ€ÐµÑÐµÐ½ÑŒÐµ_Ð¿Ð¾Ð½ÐµÐ´ÐµÐ»ÑŒÐ½Ð¸Ðº_Ð²Ñ‚Ð¾Ñ€Ð½Ð¸Ðº_ÑÑ€ÐµÐ´Ñƒ_Ñ‡ÐµÑ‚Ð²ÐµÑ€Ð³_Ð¿ÑÑ‚Ð½Ð¸Ñ†Ñƒ_ÑÑƒÐ±Ð±Ð¾Ñ‚Ñƒ".split(
                  "_"
                ),
            },
            d =
              /\[ ?[Ð’Ð²] ?(?:Ð¿Ñ€Ð¾ÑˆÐ»ÑƒÑŽ|ÑÐ»ÐµÐ´ÑƒÑŽÑ‰ÑƒÑŽ)? ?\] ?dddd/.test(
                b
              )
                ? "accusative"
                : "nominative";
          return c[d][a.day()];
        }
        return a.defineLocale("ru", {
          months: d,
          monthsShort: e,
          weekdays: f,
          weekdaysShort: "Ð²Ñ_Ð¿Ð½_Ð²Ñ‚_ÑÑ€_Ñ‡Ñ‚_Ð¿Ñ‚_ÑÐ±".split("_"),
          weekdaysMin: "Ð²Ñ_Ð¿Ð½_Ð²Ñ‚_ÑÑ€_Ñ‡Ñ‚_Ð¿Ñ‚_ÑÐ±".split("_"),
          monthsParse: [
            /^ÑÐ½Ð²/i,
            /^Ñ„ÐµÐ²/i,
            /^Ð¼Ð°Ñ€/i,
            /^Ð°Ð¿Ñ€/i,
            /^Ð¼Ð°[Ð¹|Ñ]/i,
            /^Ð¸ÑŽÐ½/i,
            /^Ð¸ÑŽÐ»/i,
            /^Ð°Ð²Ð³/i,
            /^ÑÐµÐ½/i,
            /^Ð¾ÐºÑ‚/i,
            /^Ð½Ð¾Ñ/i,
            /^Ð´ÐµÐº/i,
          ],
          longDateFormat: {
            LT: "HH:mm",
            L: "DD.MM.YYYY",
            LL: "D MMMM YYYY Ð³.",
            LLL: "D MMMM YYYY Ð³., LT",
            LLLL: "dddd, D MMMM YYYY Ð³., LT",
          },
          calendar: {
            sameDay: "[Ð¡ÐµÐ³Ð¾Ð´Ð½Ñ Ð²] LT",
            nextDay: "[Ð—Ð°Ð²Ñ‚Ñ€Ð° Ð²] LT",
            lastDay: "[Ð’Ñ‡ÐµÑ€Ð° Ð²] LT",
            nextWeek: function () {
              return 2 === this.day()
                ? "[Ð’Ð¾] dddd [Ð²] LT"
                : "[Ð’] dddd [Ð²] LT";
            },
            lastWeek: function () {
              switch (this.day()) {
                case 0:
                  return "[Ð’ Ð¿Ñ€Ð¾ÑˆÐ»Ð¾Ðµ] dddd [Ð²] LT";
                case 1:
                case 2:
                case 4:
                  return "[Ð’ Ð¿Ñ€Ð¾ÑˆÐ»Ñ‹Ð¹] dddd [Ð²] LT";
                case 3:
                case 5:
                case 6:
                  return "[Ð’ Ð¿Ñ€Ð¾ÑˆÐ»ÑƒÑŽ] dddd [Ð²] LT";
              }
            },
            sameElse: "L",
          },
          relativeTime: {
            future: "Ñ‡ÐµÑ€ÐµÐ· %s",
            past: "%s Ð½Ð°Ð·Ð°Ð´",
            s: "Ð½ÐµÑÐºÐ¾Ð»ÑŒÐºÐ¾ ÑÐµÐºÑƒÐ½Ð´",
            m: c,
            mm: c,
            h: "Ñ‡Ð°Ñ",
            hh: c,
            d: "Ð´ÐµÐ½ÑŒ",
            dd: c,
            M: "Ð¼ÐµÑÑÑ†",
            MM: c,
            y: "Ð³Ð¾Ð´",
            yy: c,
          },
          meridiemParse: /Ð½Ð¾Ñ‡Ð¸|ÑƒÑ‚Ñ€Ð°|Ð´Ð½Ñ|Ð²ÐµÑ‡ÐµÑ€Ð°/i,
          isPM: function (a) {
            return /^(Ð´Ð½Ñ|Ð²ÐµÑ‡ÐµÑ€Ð°)$/.test(a);
          },
          meridiem: function (a) {
            return 4 > a
              ? "Ð½Ð¾Ñ‡Ð¸"
              : 12 > a
              ? "ÑƒÑ‚Ñ€Ð°"
              : 17 > a
              ? "Ð´Ð½Ñ"
              : "Ð²ÐµÑ‡ÐµÑ€Ð°";
          },
          ordinal: function (a, b) {
            switch (b) {
              case "M":
              case "d":
              case "DDD":
                return a + "-Ð¹";
              case "D":
                return a + "-Ð³Ð¾";
              case "w":
              case "W":
                return a + "-Ñ";
              default:
                return a;
            }
          },
          week: { dow: 1, doy: 7 },
        });
      }),
      (function (a) {
        a(tb);
      })(function (a) {
        function b(a) {
          return a > 1 && 5 > a;
        }
        function c(a, c, d, e) {
          var f = a + " ";
          switch (d) {
            case "s":
              return c || e ? "pÃ¡r sekÃºnd" : "pÃ¡r sekundami";
            case "m":
              return c ? "minÃºta" : e ? "minÃºtu" : "minÃºtou";
            case "mm":
              return c || e
                ? f + (b(a) ? "minÃºty" : "minÃºt")
                : f + "minÃºtami";
              break;
            case "h":
              return c ? "hodina" : e ? "hodinu" : "hodinou";
            case "hh":
              return c || e ? f + (b(a) ? "hodiny" : "hodÃ­n") : f + "hodinami";
              break;
            case "d":
              return c || e ? "deÅˆ" : "dÅˆom";
            case "dd":
              return c || e ? f + (b(a) ? "dni" : "dnÃ­") : f + "dÅˆami";
              break;
            case "M":
              return c || e ? "mesiac" : "mesiacom";
            case "MM":
              return c || e
                ? f + (b(a) ? "mesiace" : "mesiacov")
                : f + "mesiacmi";
              break;
            case "y":
              return c || e ? "rok" : "rokom";
            case "yy":
              return c || e ? f + (b(a) ? "roky" : "rokov") : f + "rokmi";
          }
        }
        var d =
            "januÃ¡r_februÃ¡r_marec_aprÃ­l_mÃ¡j_jÃºn_jÃºl_august_september_oktÃ³ber_november_december".split(
              "_"
            ),
          e = "jan_feb_mar_apr_mÃ¡j_jÃºn_jÃºl_aug_sep_okt_nov_dec".split("_");
        return a.defineLocale("sk", {
          months: d,
          monthsShort: e,
          monthsParse: (function (a, b) {
            var c,
              d = [];
            for (c = 0; 12 > c; c++)
              d[c] = new RegExp("^" + a[c] + "$|^" + b[c] + "$", "i");
            return d;
          })(d, e),
          weekdays:
            "nedeÄ¾a_pondelok_utorok_streda_Å¡tvrtok_piatok_sobota".split("_"),
          weekdaysShort: "ne_po_ut_st_Å¡t_pi_so".split("_"),
          weekdaysMin: "ne_po_ut_st_Å¡t_pi_so".split("_"),
          longDateFormat: {
            LT: "H:mm",
            L: "DD.MM.YYYY",
            LL: "D. MMMM YYYY",
            LLL: "D. MMMM YYYY LT",
            LLLL: "dddd D. MMMM YYYY LT",
          },
          calendar: {
            sameDay: "[dnes o] LT",
            nextDay: "[zajtra o] LT",
            nextWeek: function () {
              switch (this.day()) {
                case 0:
                  return "[v nedeÄ¾u o] LT";
                case 1:
                case 2:
                  return "[v] dddd [o] LT";
                case 3:
                  return "[v stredu o] LT";
                case 4:
                  return "[vo Å¡tvrtok o] LT";
                case 5:
                  return "[v piatok o] LT";
                case 6:
                  return "[v sobotu o] LT";
              }
            },
            lastDay: "[vÄera o] LT",
            lastWeek: function () {
              switch (this.day()) {
                case 0:
                  return "[minulÃº nedeÄ¾u o] LT";
                case 1:
                case 2:
                  return "[minulÃ½] dddd [o] LT";
                case 3:
                  return "[minulÃº stredu o] LT";
                case 4:
                case 5:
                  return "[minulÃ½] dddd [o] LT";
                case 6:
                  return "[minulÃº sobotu o] LT";
              }
            },
            sameElse: "L",
          },
          relativeTime: {
            future: "za %s",
            past: "pred %s",
            s: c,
            m: c,
            mm: c,
            h: c,
            hh: c,
            d: c,
            dd: c,
            M: c,
            MM: c,
            y: c,
            yy: c,
          },
          ordinal: "%d.",
          week: { dow: 1, doy: 4 },
        });
      }),
      (function (a) {
        a(tb);
      })(function (a) {
        function b(a, b, c) {
          var d = a + " ";
          switch (c) {
            case "m":
              return b ? "ena minuta" : "eno minuto";
            case "mm":
              return (d +=
                1 === a
                  ? "minuta"
                  : 2 === a
                  ? "minuti"
                  : 3 === a || 4 === a
                  ? "minute"
                  : "minut");
            case "h":
              return b ? "ena ura" : "eno uro";
            case "hh":
              return (d +=
                1 === a
                  ? "ura"
                  : 2 === a
                  ? "uri"
                  : 3 === a || 4 === a
                  ? "ure"
                  : "ur");
            case "dd":
              return (d += 1 === a ? "dan" : "dni");
            case "MM":
              return (d +=
                1 === a
                  ? "mesec"
                  : 2 === a
                  ? "meseca"
                  : 3 === a || 4 === a
                  ? "mesece"
                  : "mesecev");
            case "yy":
              return (d +=
                1 === a
                  ? "leto"
                  : 2 === a
                  ? "leti"
                  : 3 === a || 4 === a
                  ? "leta"
                  : "let");
          }
        }
        return a.defineLocale("sl", {
          months:
            "januar_februar_marec_april_maj_junij_julij_avgust_september_oktober_november_december".split(
              "_"
            ),
          monthsShort:
            "jan._feb._mar._apr._maj._jun._jul._avg._sep._okt._nov._dec.".split(
              "_"
            ),
          weekdays: "nedelja_ponedeljek_torek_sreda_Äetrtek_petek_sobota".split(
            "_"
          ),
          weekdaysShort: "ned._pon._tor._sre._Äet._pet._sob.".split("_"),
          weekdaysMin: "ne_po_to_sr_Äe_pe_so".split("_"),
          longDateFormat: {
            LT: "H:mm",
            L: "DD. MM. YYYY",
            LL: "D. MMMM YYYY",
            LLL: "D. MMMM YYYY LT",
            LLLL: "dddd, D. MMMM YYYY LT",
          },
          calendar: {
            sameDay: "[danes ob] LT",
            nextDay: "[jutri ob] LT",
            nextWeek: function () {
              switch (this.day()) {
                case 0:
                  return "[v] [nedeljo] [ob] LT";
                case 3:
                  return "[v] [sredo] [ob] LT";
                case 6:
                  return "[v] [soboto] [ob] LT";
                case 1:
                case 2:
                case 4:
                case 5:
                  return "[v] dddd [ob] LT";
              }
            },
            lastDay: "[vÄeraj ob] LT",
            lastWeek: function () {
              switch (this.day()) {
                case 0:
                case 3:
                case 6:
                  return "[prejÅ¡nja] dddd [ob] LT";
                case 1:
                case 2:
                case 4:
                case 5:
                  return "[prejÅ¡nji] dddd [ob] LT";
              }
            },
            sameElse: "L",
          },
          relativeTime: {
            future: "Äez %s",
            past: "%s nazaj",
            s: "nekaj sekund",
            m: b,
            mm: b,
            h: b,
            hh: b,
            d: "en dan",
            dd: b,
            M: "en mesec",
            MM: b,
            y: "eno leto",
            yy: b,
          },
          ordinal: "%d.",
          week: { dow: 1, doy: 7 },
        });
      }),
      (function (a) {
        a(tb);
      })(function (a) {
        return a.defineLocale("sq", {
          months:
            "Janar_Shkurt_Mars_Prill_Maj_Qershor_Korrik_Gusht_Shtator_Tetor_NÃ«ntor_Dhjetor".split(
              "_"
            ),
          monthsShort: "Jan_Shk_Mar_Pri_Maj_Qer_Kor_Gus_Sht_Tet_NÃ«n_Dhj".split(
            "_"
          ),
          weekdays:
            "E Diel_E HÃ«nÃ«_E MartÃ«_E MÃ«rkurÃ«_E Enjte_E Premte_E ShtunÃ«".split(
              "_"
            ),
          weekdaysShort: "Die_HÃ«n_Mar_MÃ«r_Enj_Pre_Sht".split("_"),
          weekdaysMin: "D_H_Ma_MÃ«_E_P_Sh".split("_"),
          meridiem: function (a) {
            return 12 > a ? "PD" : "MD";
          },
          longDateFormat: {
            LT: "HH:mm",
            L: "DD/MM/YYYY",
            LL: "D MMMM YYYY",
            LLL: "D MMMM YYYY LT",
            LLLL: "dddd, D MMMM YYYY LT",
          },
          calendar: {
            sameDay: "[Sot nÃ«] LT",
            nextDay: "[NesÃ«r nÃ«] LT",
            nextWeek: "dddd [nÃ«] LT",
            lastDay: "[Dje nÃ«] LT",
            lastWeek: "dddd [e kaluar nÃ«] LT",
            sameElse: "L",
          },
          relativeTime: {
            future: "nÃ« %s",
            past: "%s mÃ« parÃ«",
            s: "disa sekonda",
            m: "njÃ« minutÃ«",
            mm: "%d minuta",
            h: "njÃ« orÃ«",
            hh: "%d orÃ«",
            d: "njÃ« ditÃ«",
            dd: "%d ditÃ«",
            M: "njÃ« muaj",
            MM: "%d muaj",
            y: "njÃ« vit",
            yy: "%d vite",
          },
          ordinal: "%d.",
          week: { dow: 1, doy: 4 },
        });
      }),
      (function (a) {
        a(tb);
      })(function (a) {
        var b = {
          words: {
            m: ["Ñ˜ÐµÐ´Ð°Ð½ Ð¼Ð¸Ð½ÑƒÑ‚", "Ñ˜ÐµÐ´Ð½Ðµ Ð¼Ð¸Ð½ÑƒÑ‚Ðµ"],
            mm: ["Ð¼Ð¸Ð½ÑƒÑ‚", "Ð¼Ð¸Ð½ÑƒÑ‚Ðµ", "Ð¼Ð¸Ð½ÑƒÑ‚Ð°"],
            h: ["Ñ˜ÐµÐ´Ð°Ð½ ÑÐ°Ñ‚", "Ñ˜ÐµÐ´Ð½Ð¾Ð³ ÑÐ°Ñ‚Ð°"],
            hh: ["ÑÐ°Ñ‚", "ÑÐ°Ñ‚Ð°", "ÑÐ°Ñ‚Ð¸"],
            dd: ["Ð´Ð°Ð½", "Ð´Ð°Ð½Ð°", "Ð´Ð°Ð½Ð°"],
            MM: ["Ð¼ÐµÑÐµÑ†", "Ð¼ÐµÑÐµÑ†Ð°", "Ð¼ÐµÑÐµÑ†Ð¸"],
            yy: ["Ð³Ð¾Ð´Ð¸Ð½Ð°", "Ð³Ð¾Ð´Ð¸Ð½Ðµ", "Ð³Ð¾Ð´Ð¸Ð½Ð°"],
          },
          correctGrammaticalCase: function (a, b) {
            return 1 === a ? b[0] : a >= 2 && 4 >= a ? b[1] : b[2];
          },
          translate: function (a, c, d) {
            var e = b.words[d];
            return 1 === d.length
              ? c
                ? e[0]
                : e[1]
              : a + " " + b.correctGrammaticalCase(a, e);
          },
        };
        return a.defineLocale("sr-cyrl", {
          months: [
            "Ñ˜Ð°Ð½ÑƒÐ°Ñ€",
            "Ñ„ÐµÐ±Ñ€ÑƒÐ°Ñ€",
            "Ð¼Ð°Ñ€Ñ‚",
            "Ð°Ð¿Ñ€Ð¸Ð»",
            "Ð¼Ð°Ñ˜",
            "Ñ˜ÑƒÐ½",
            "Ñ˜ÑƒÐ»",
            "Ð°Ð²Ð³ÑƒÑÑ‚",
            "ÑÐµÐ¿Ñ‚ÐµÐ¼Ð±Ð°Ñ€",
            "Ð¾ÐºÑ‚Ð¾Ð±Ð°Ñ€",
            "Ð½Ð¾Ð²ÐµÐ¼Ð±Ð°Ñ€",
            "Ð´ÐµÑ†ÐµÐ¼Ð±Ð°Ñ€",
          ],
          monthsShort: [
            "Ñ˜Ð°Ð½.",
            "Ñ„ÐµÐ±.",
            "Ð¼Ð°Ñ€.",
            "Ð°Ð¿Ñ€.",
            "Ð¼Ð°Ñ˜",
            "Ñ˜ÑƒÐ½",
            "Ñ˜ÑƒÐ»",
            "Ð°Ð²Ð³.",
            "ÑÐµÐ¿.",
            "Ð¾ÐºÑ‚.",
            "Ð½Ð¾Ð².",
            "Ð´ÐµÑ†.",
          ],
          weekdays: [
            "Ð½ÐµÐ´ÐµÑ™Ð°",
            "Ð¿Ð¾Ð½ÐµÐ´ÐµÑ™Ð°Ðº",
            "ÑƒÑ‚Ð¾Ñ€Ð°Ðº",
            "ÑÑ€ÐµÐ´Ð°",
            "Ñ‡ÐµÑ‚Ð²Ñ€Ñ‚Ð°Ðº",
            "Ð¿ÐµÑ‚Ð°Ðº",
            "ÑÑƒÐ±Ð¾Ñ‚Ð°",
          ],
          weekdaysShort: [
            "Ð½ÐµÐ´.",
            "Ð¿Ð¾Ð½.",
            "ÑƒÑ‚Ð¾.",
            "ÑÑ€Ðµ.",
            "Ñ‡ÐµÑ‚.",
            "Ð¿ÐµÑ‚.",
            "ÑÑƒÐ±.",
          ],
          weekdaysMin: ["Ð½Ðµ", "Ð¿Ð¾", "ÑƒÑ‚", "ÑÑ€", "Ñ‡Ðµ", "Ð¿Ðµ", "ÑÑƒ"],
          longDateFormat: {
            LT: "H:mm",
            L: "DD. MM. YYYY",
            LL: "D. MMMM YYYY",
            LLL: "D. MMMM YYYY LT",
            LLLL: "dddd, D. MMMM YYYY LT",
          },
          calendar: {
            sameDay: "[Ð´Ð°Ð½Ð°Ñ Ñƒ] LT",
            nextDay: "[ÑÑƒÑ‚Ñ€Ð° Ñƒ] LT",
            nextWeek: function () {
              switch (this.day()) {
                case 0:
                  return "[Ñƒ] [Ð½ÐµÐ´ÐµÑ™Ñƒ] [Ñƒ] LT";
                case 3:
                  return "[Ñƒ] [ÑÑ€ÐµÐ´Ñƒ] [Ñƒ] LT";
                case 6:
                  return "[Ñƒ] [ÑÑƒÐ±Ð¾Ñ‚Ñƒ] [Ñƒ] LT";
                case 1:
                case 2:
                case 4:
                case 5:
                  return "[Ñƒ] dddd [Ñƒ] LT";
              }
            },
            lastDay: "[Ñ˜ÑƒÑ‡Ðµ Ñƒ] LT",
            lastWeek: function () {
              var a = [
                "[Ð¿Ñ€Ð¾ÑˆÐ»Ðµ] [Ð½ÐµÐ´ÐµÑ™Ðµ] [Ñƒ] LT",
                "[Ð¿Ñ€Ð¾ÑˆÐ»Ð¾Ð³] [Ð¿Ð¾Ð½ÐµÐ´ÐµÑ™ÐºÐ°] [Ñƒ] LT",
                "[Ð¿Ñ€Ð¾ÑˆÐ»Ð¾Ð³] [ÑƒÑ‚Ð¾Ñ€ÐºÐ°] [Ñƒ] LT",
                "[Ð¿Ñ€Ð¾ÑˆÐ»Ðµ] [ÑÑ€ÐµÐ´Ðµ] [Ñƒ] LT",
                "[Ð¿Ñ€Ð¾ÑˆÐ»Ð¾Ð³] [Ñ‡ÐµÑ‚Ð²Ñ€Ñ‚ÐºÐ°] [Ñƒ] LT",
                "[Ð¿Ñ€Ð¾ÑˆÐ»Ð¾Ð³] [Ð¿ÐµÑ‚ÐºÐ°] [Ñƒ] LT",
                "[Ð¿Ñ€Ð¾ÑˆÐ»Ðµ] [ÑÑƒÐ±Ð¾Ñ‚Ðµ] [Ñƒ] LT",
              ];
              return a[this.day()];
            },
            sameElse: "L",
          },
          relativeTime: {
            future: "Ð·Ð° %s",
            past: "Ð¿Ñ€Ðµ %s",
            s: "Ð½ÐµÐºÐ¾Ð»Ð¸ÐºÐ¾ ÑÐµÐºÑƒÐ½Ð´Ð¸",
            m: b.translate,
            mm: b.translate,
            h: b.translate,
            hh: b.translate,
            d: "Ð´Ð°Ð½",
            dd: b.translate,
            M: "Ð¼ÐµÑÐµÑ†",
            MM: b.translate,
            y: "Ð³Ð¾Ð´Ð¸Ð½Ñƒ",
            yy: b.translate,
          },
          ordinal: "%d.",
          week: { dow: 1, doy: 7 },
        });
      }),
      (function (a) {
        a(tb);
      })(function (a) {
        var b = {
          words: {
            m: ["jedan minut", "jedne minute"],
            mm: ["minut", "minute", "minuta"],
            h: ["jedan sat", "jednog sata"],
            hh: ["sat", "sata", "sati"],
            dd: ["dan", "dana", "dana"],
            MM: ["mesec", "meseca", "meseci"],
            yy: ["godina", "godine", "godina"],
          },
          correctGrammaticalCase: function (a, b) {
            return 1 === a ? b[0] : a >= 2 && 4 >= a ? b[1] : b[2];
          },
          translate: function (a, c, d) {
            var e = b.words[d];
            return 1 === d.length
              ? c
                ? e[0]
                : e[1]
              : a + " " + b.correctGrammaticalCase(a, e);
          },
        };
        return a.defineLocale("sr", {
          months: [
            "januar",
            "februar",
            "mart",
            "april",
            "maj",
            "jun",
            "jul",
            "avgust",
            "septembar",
            "oktobar",
            "novembar",
            "decembar",
          ],
          monthsShort: [
            "jan.",
            "feb.",
            "mar.",
            "apr.",
            "maj",
            "jun",
            "jul",
            "avg.",
            "sep.",
            "okt.",
            "nov.",
            "dec.",
          ],
          weekdays: [
            "nedelja",
            "ponedeljak",
            "utorak",
            "sreda",
            "Äetvrtak",
            "petak",
            "subota",
          ],
          weekdaysShort: [
            "ned.",
            "pon.",
            "uto.",
            "sre.",
            "Äet.",
            "pet.",
            "sub.",
          ],
          weekdaysMin: ["ne", "po", "ut", "sr", "Äe", "pe", "su"],
          longDateFormat: {
            LT: "H:mm",
            L: "DD. MM. YYYY",
            LL: "D. MMMM YYYY",
            LLL: "D. MMMM YYYY LT",
            LLLL: "dddd, D. MMMM YYYY LT",
          },
          calendar: {
            sameDay: "[danas u] LT",
            nextDay: "[sutra u] LT",
            nextWeek: function () {
              switch (this.day()) {
                case 0:
                  return "[u] [nedelju] [u] LT";
                case 3:
                  return "[u] [sredu] [u] LT";
                case 6:
                  return "[u] [subotu] [u] LT";
                case 1:
                case 2:
                case 4:
                case 5:
                  return "[u] dddd [u] LT";
              }
            },
            lastDay: "[juÄe u] LT",
            lastWeek: function () {
              var a = [
                "[proÅ¡le] [nedelje] [u] LT",
                "[proÅ¡log] [ponedeljka] [u] LT",
                "[proÅ¡log] [utorka] [u] LT",
                "[proÅ¡le] [srede] [u] LT",
                "[proÅ¡log] [Äetvrtka] [u] LT",
                "[proÅ¡log] [petka] [u] LT",
                "[proÅ¡le] [subote] [u] LT",
              ];
              return a[this.day()];
            },
            sameElse: "L",
          },
          relativeTime: {
            future: "za %s",
            past: "pre %s",
            s: "nekoliko sekundi",
            m: b.translate,
            mm: b.translate,
            h: b.translate,
            hh: b.translate,
            d: "dan",
            dd: b.translate,
            M: "mesec",
            MM: b.translate,
            y: "godinu",
            yy: b.translate,
          },
          ordinal: "%d.",
          week: { dow: 1, doy: 7 },
        });
      }),
      (function (a) {
        a(tb);
      })(function (a) {
        return a.defineLocale("sv", {
          months:
            "januari_februari_mars_april_maj_juni_juli_augusti_september_oktober_november_december".split(
              "_"
            ),
          monthsShort: "jan_feb_mar_apr_maj_jun_jul_aug_sep_okt_nov_dec".split(
            "_"
          ),
          weekdays:
            "sÃ¶ndag_mÃ¥ndag_tisdag_onsdag_torsdag_fredag_lÃ¶rdag".split("_"),
          weekdaysShort: "sÃ¶n_mÃ¥n_tis_ons_tor_fre_lÃ¶r".split("_"),
          weekdaysMin: "sÃ¶_mÃ¥_ti_on_to_fr_lÃ¶".split("_"),
          longDateFormat: {
            LT: "HH:mm",
            L: "YYYY-MM-DD",
            LL: "D MMMM YYYY",
            LLL: "D MMMM YYYY LT",
            LLLL: "dddd D MMMM YYYY LT",
          },
          calendar: {
            sameDay: "[Idag] LT",
            nextDay: "[Imorgon] LT",
            lastDay: "[IgÃ¥r] LT",
            nextWeek: "dddd LT",
            lastWeek: "[FÃ¶rra] dddd[en] LT",
            sameElse: "L",
          },
          relativeTime: {
            future: "om %s",
            past: "fÃ¶r %s sedan",
            s: "nÃ¥gra sekunder",
            m: "en minut",
            mm: "%d minuter",
            h: "en timme",
            hh: "%d timmar",
            d: "en dag",
            dd: "%d dagar",
            M: "en mÃ¥nad",
            MM: "%d mÃ¥nader",
            y: "ett Ã¥r",
            yy: "%d Ã¥r",
          },
          ordinal: function (a) {
            var b = a % 10,
              c =
                1 === ~~((a % 100) / 10)
                  ? "e"
                  : 1 === b
                  ? "a"
                  : 2 === b
                  ? "a"
                  : 3 === b
                  ? "e"
                  : "e";
            return a + c;
          },
          week: { dow: 1, doy: 4 },
        });
      }),
      (function (a) {
        a(tb);
      })(function (a) {
        return a.defineLocale("ta", {
          months:
            "à®œà®©à®µà®°à®¿_à®ªà®¿à®ªà¯à®°à®µà®°à®¿_à®®à®¾à®°à¯à®šà¯_à®à®ªà¯à®°à®²à¯_à®®à¯‡_à®œà¯‚à®©à¯_à®œà¯‚à®²à¯ˆ_à®†à®•à®¸à¯à®Ÿà¯_à®šà¯†à®ªà¯à®Ÿà¯†à®®à¯à®ªà®°à¯_à®…à®•à¯à®Ÿà¯‡à®¾à®ªà®°à¯_à®¨à®µà®®à¯à®ªà®°à¯_à®Ÿà®¿à®šà®®à¯à®ªà®°à¯".split(
              "_"
            ),
          monthsShort:
            "à®œà®©à®µà®°à®¿_à®ªà®¿à®ªà¯à®°à®µà®°à®¿_à®®à®¾à®°à¯à®šà¯_à®à®ªà¯à®°à®²à¯_à®®à¯‡_à®œà¯‚à®©à¯_à®œà¯‚à®²à¯ˆ_à®†à®•à®¸à¯à®Ÿà¯_à®šà¯†à®ªà¯à®Ÿà¯†à®®à¯à®ªà®°à¯_à®…à®•à¯à®Ÿà¯‡à®¾à®ªà®°à¯_à®¨à®µà®®à¯à®ªà®°à¯_à®Ÿà®¿à®šà®®à¯à®ªà®°à¯".split(
              "_"
            ),
          weekdays:
            "à®žà®¾à®¯à®¿à®±à¯à®±à¯à®•à¯à®•à®¿à®´à®®à¯ˆ_à®¤à®¿à®™à¯à®•à®Ÿà¯à®•à®¿à®´à®®à¯ˆ_à®šà¯†à®µà¯à®µà®¾à®¯à¯à®•à®¿à®´à®®à¯ˆ_à®ªà¯à®¤à®©à¯à®•à®¿à®´à®®à¯ˆ_à®µà®¿à®¯à®¾à®´à®•à¯à®•à®¿à®´à®®à¯ˆ_à®µà¯†à®³à¯à®³à®¿à®•à¯à®•à®¿à®´à®®à¯ˆ_à®šà®©à®¿à®•à¯à®•à®¿à®´à®®à¯ˆ".split(
              "_"
            ),
          weekdaysShort:
            "à®žà®¾à®¯à®¿à®±à¯_à®¤à®¿à®™à¯à®•à®³à¯_à®šà¯†à®µà¯à®µà®¾à®¯à¯_à®ªà¯à®¤à®©à¯_à®µà®¿à®¯à®¾à®´à®©à¯_à®µà¯†à®³à¯à®³à®¿_à®šà®©à®¿".split(
              "_"
            ),
          weekdaysMin: "à®žà®¾_à®¤à®¿_à®šà¯†_à®ªà¯_à®µà®¿_à®µà¯†_à®š".split(
            "_"
          ),
          longDateFormat: {
            LT: "HH:mm",
            L: "DD/MM/YYYY",
            LL: "D MMMM YYYY",
            LLL: "D MMMM YYYY, LT",
            LLLL: "dddd, D MMMM YYYY, LT",
          },
          calendar: {
            sameDay: "[à®‡à®©à¯à®±à¯] LT",
            nextDay: "[à®¨à®¾à®³à¯ˆ] LT",
            nextWeek: "dddd, LT",
            lastDay: "[à®¨à¯‡à®±à¯à®±à¯] LT",
            lastWeek: "[à®•à®Ÿà®¨à¯à®¤ à®µà®¾à®°à®®à¯] dddd, LT",
            sameElse: "L",
          },
          relativeTime: {
            future: "%s à®‡à®²à¯",
            past: "%s à®®à¯à®©à¯",
            s: "à®’à®°à¯ à®šà®¿à®² à®µà®¿à®¨à®¾à®Ÿà®¿à®•à®³à¯",
            m: "à®’à®°à¯ à®¨à®¿à®®à®¿à®Ÿà®®à¯",
            mm: "%d à®¨à®¿à®®à®¿à®Ÿà®™à¯à®•à®³à¯",
            h: "à®’à®°à¯ à®®à®£à®¿ à®¨à¯‡à®°à®®à¯",
            hh: "%d à®®à®£à®¿ à®¨à¯‡à®°à®®à¯",
            d: "à®’à®°à¯ à®¨à®¾à®³à¯",
            dd: "%d à®¨à®¾à®Ÿà¯à®•à®³à¯",
            M: "à®’à®°à¯ à®®à®¾à®¤à®®à¯",
            MM: "%d à®®à®¾à®¤à®™à¯à®•à®³à¯",
            y: "à®’à®°à¯ à®µà®°à¯à®Ÿà®®à¯",
            yy: "%d à®†à®£à¯à®Ÿà¯à®•à®³à¯",
          },
          ordinal: function (a) {
            return a + "à®µà®¤à¯";
          },
          meridiem: function (a) {
            return a >= 6 && 10 >= a
              ? " à®•à®¾à®²à¯ˆ"
              : a >= 10 && 14 >= a
              ? " à®¨à®£à¯à®ªà®•à®²à¯"
              : a >= 14 && 18 >= a
              ? " à®Žà®±à¯à®ªà®¾à®Ÿà¯"
              : a >= 18 && 20 >= a
              ? " à®®à®¾à®²à¯ˆ"
              : a >= 20 && 24 >= a
              ? " à®‡à®°à®µà¯"
              : a >= 0 && 6 >= a
              ? " à®µà¯ˆà®•à®±à¯ˆ"
              : void 0;
          },
          week: { dow: 0, doy: 6 },
        });
      }),
      (function (a) {
        a(tb);
      })(function (a) {
        return a.defineLocale("th", {
          months:
            "à¸¡à¸à¸£à¸²à¸„à¸¡_à¸à¸¸à¸¡à¸ à¸²à¸žà¸±à¸™à¸˜à¹Œ_à¸¡à¸µà¸™à¸²à¸„à¸¡_à¹€à¸¡à¸©à¸²à¸¢à¸™_à¸žà¸¤à¸©à¸ à¸²à¸„à¸¡_à¸¡à¸´à¸–à¸¸à¸™à¸²à¸¢à¸™_à¸à¸£à¸à¸Žà¸²à¸„à¸¡_à¸ªà¸´à¸‡à¸«à¸²à¸„à¸¡_à¸à¸±à¸™à¸¢à¸²à¸¢à¸™_à¸•à¸¸à¸¥à¸²à¸„à¸¡_à¸žà¸¤à¸¨à¸ˆà¸´à¸à¸²à¸¢à¸™_à¸˜à¸±à¸™à¸§à¸²à¸„à¸¡".split(
              "_"
            ),
          monthsShort:
            "à¸¡à¸à¸£à¸²_à¸à¸¸à¸¡à¸ à¸²_à¸¡à¸µà¸™à¸²_à¹€à¸¡à¸©à¸²_à¸žà¸¤à¸©à¸ à¸²_à¸¡à¸´à¸–à¸¸à¸™à¸²_à¸à¸£à¸à¸Žà¸²_à¸ªà¸´à¸‡à¸«à¸²_à¸à¸±à¸™à¸¢à¸²_à¸•à¸¸à¸¥à¸²_à¸žà¸¤à¸¨à¸ˆà¸´à¸à¸²_à¸˜à¸±à¸™à¸§à¸²".split(
              "_"
            ),
          weekdays:
            "à¸­à¸²à¸—à¸´à¸•à¸¢à¹Œ_à¸ˆà¸±à¸™à¸—à¸£à¹Œ_à¸­à¸±à¸‡à¸„à¸²à¸£_à¸žà¸¸à¸˜_à¸žà¸¤à¸«à¸±à¸ªà¸šà¸”à¸µ_à¸¨à¸¸à¸à¸£à¹Œ_à¹€à¸ªà¸²à¸£à¹Œ".split(
              "_"
            ),
          weekdaysShort:
            "à¸­à¸²à¸—à¸´à¸•à¸¢à¹Œ_à¸ˆà¸±à¸™à¸—à¸£à¹Œ_à¸­à¸±à¸‡à¸„à¸²à¸£_à¸žà¸¸à¸˜_à¸žà¸¤à¸«à¸±à¸ª_à¸¨à¸¸à¸à¸£à¹Œ_à¹€à¸ªà¸²à¸£à¹Œ".split(
              "_"
            ),
          weekdaysMin: "à¸­à¸²._à¸ˆ._à¸­._à¸ž._à¸žà¸¤._à¸¨._à¸ª.".split("_"),
          longDateFormat: {
            LT: "H à¸™à¸²à¸¬à¸´à¸à¸² m à¸™à¸²à¸—à¸µ",
            L: "YYYY/MM/DD",
            LL: "D MMMM YYYY",
            LLL: "D MMMM YYYY à¹€à¸§à¸¥à¸² LT",
            LLLL: "à¸§à¸±à¸™ddddà¸—à¸µà¹ˆ D MMMM YYYY à¹€à¸§à¸¥à¸² LT",
          },
          meridiem: function (a) {
            return 12 > a
              ? "à¸à¹ˆà¸­à¸™à¹€à¸—à¸µà¹ˆà¸¢à¸‡"
              : "à¸«à¸¥à¸±à¸‡à¹€à¸—à¸µà¹ˆà¸¢à¸‡";
          },
          calendar: {
            sameDay: "[à¸§à¸±à¸™à¸™à¸µà¹‰ à¹€à¸§à¸¥à¸²] LT",
            nextDay: "[à¸žà¸£à¸¸à¹ˆà¸‡à¸™à¸µà¹‰ à¹€à¸§à¸¥à¸²] LT",
            nextWeek: "dddd[à¸«à¸™à¹‰à¸² à¹€à¸§à¸¥à¸²] LT",
            lastDay: "[à¹€à¸¡à¸·à¹ˆà¸­à¸§à¸²à¸™à¸™à¸µà¹‰ à¹€à¸§à¸¥à¸²] LT",
            lastWeek: "[à¸§à¸±à¸™]dddd[à¸—à¸µà¹ˆà¹à¸¥à¹‰à¸§ à¹€à¸§à¸¥à¸²] LT",
            sameElse: "L",
          },
          relativeTime: {
            future: "à¸­à¸µà¸ %s",
            past: "%sà¸—à¸µà¹ˆà¹à¸¥à¹‰à¸§",
            s: "à¹„à¸¡à¹ˆà¸à¸µà¹ˆà¸§à¸´à¸™à¸²à¸—à¸µ",
            m: "1 à¸™à¸²à¸—à¸µ",
            mm: "%d à¸™à¸²à¸—à¸µ",
            h: "1 à¸Šà¸±à¹ˆà¸§à¹‚à¸¡à¸‡",
            hh: "%d à¸Šà¸±à¹ˆà¸§à¹‚à¸¡à¸‡",
            d: "1 à¸§à¸±à¸™",
            dd: "%d à¸§à¸±à¸™",
            M: "1 à¹€à¸”à¸·à¸­à¸™",
            MM: "%d à¹€à¸”à¸·à¸­à¸™",
            y: "1 à¸›à¸µ",
            yy: "%d à¸›à¸µ",
          },
        });
      }),
      (function (a) {
        a(tb);
      })(function (a) {
        return a.defineLocale("tl-ph", {
          months:
            "Enero_Pebrero_Marso_Abril_Mayo_Hunyo_Hulyo_Agosto_Setyembre_Oktubre_Nobyembre_Disyembre".split(
              "_"
            ),
          monthsShort: "Ene_Peb_Mar_Abr_May_Hun_Hul_Ago_Set_Okt_Nob_Dis".split(
            "_"
          ),
          weekdays:
            "Linggo_Lunes_Martes_Miyerkules_Huwebes_Biyernes_Sabado".split("_"),
          weekdaysShort: "Lin_Lun_Mar_Miy_Huw_Biy_Sab".split("_"),
          weekdaysMin: "Li_Lu_Ma_Mi_Hu_Bi_Sab".split("_"),
          longDateFormat: {
            LT: "HH:mm",
            L: "MM/D/YYYY",
            LL: "MMMM D, YYYY",
            LLL: "MMMM D, YYYY LT",
            LLLL: "dddd, MMMM DD, YYYY LT",
          },
          calendar: {
            sameDay: "[Ngayon sa] LT",
            nextDay: "[Bukas sa] LT",
            nextWeek: "dddd [sa] LT",
            lastDay: "[Kahapon sa] LT",
            lastWeek: "dddd [huling linggo] LT",
            sameElse: "L",
          },
          relativeTime: {
            future: "sa loob ng %s",
            past: "%s ang nakalipas",
            s: "ilang segundo",
            m: "isang minuto",
            mm: "%d minuto",
            h: "isang oras",
            hh: "%d oras",
            d: "isang araw",
            dd: "%d araw",
            M: "isang buwan",
            MM: "%d buwan",
            y: "isang taon",
            yy: "%d taon",
          },
          ordinal: function (a) {
            return a;
          },
          week: { dow: 1, doy: 4 },
        });
      }),
      (function (a) {
        a(tb);
      })(function (a) {
        var b = {
          1: "'inci",
          5: "'inci",
          8: "'inci",
          70: "'inci",
          80: "'inci",
          2: "'nci",
          7: "'nci",
          20: "'nci",
          50: "'nci",
          3: "'Ã¼ncÃ¼",
          4: "'Ã¼ncÃ¼",
          100: "'Ã¼ncÃ¼",
          6: "'ncÄ±",
          9: "'uncu",
          10: "'uncu",
          30: "'uncu",
          60: "'Ä±ncÄ±",
          90: "'Ä±ncÄ±",
        };
        return a.defineLocale("tr", {
          months:
            "Ocak_Åžubat_Mart_Nisan_MayÄ±s_Haziran_Temmuz_AÄŸustos_EylÃ¼l_Ekim_KasÄ±m_AralÄ±k".split(
              "_"
            ),
          monthsShort:
            "Oca_Åžub_Mar_Nis_May_Haz_Tem_AÄŸu_Eyl_Eki_Kas_Ara".split("_"),
          weekdays:
            "Pazar_Pazartesi_SalÄ±_Ã‡arÅŸamba_PerÅŸembe_Cuma_Cumartesi".split(
              "_"
            ),
          weekdaysShort: "Paz_Pts_Sal_Ã‡ar_Per_Cum_Cts".split("_"),
          weekdaysMin: "Pz_Pt_Sa_Ã‡a_Pe_Cu_Ct".split("_"),
          longDateFormat: {
            LT: "HH:mm",
            L: "DD.MM.YYYY",
            LL: "D MMMM YYYY",
            LLL: "D MMMM YYYY LT",
            LLLL: "dddd, D MMMM YYYY LT",
          },
          calendar: {
            sameDay: "[bugÃ¼n saat] LT",
            nextDay: "[yarÄ±n saat] LT",
            nextWeek: "[haftaya] dddd [saat] LT",
            lastDay: "[dÃ¼n] LT",
            lastWeek: "[geÃ§en hafta] dddd [saat] LT",
            sameElse: "L",
          },
          relativeTime: {
            future: "%s sonra",
            past: "%s Ã¶nce",
            s: "birkaÃ§ saniye",
            m: "bir dakika",
            mm: "%d dakika",
            h: "bir saat",
            hh: "%d saat",
            d: "bir gÃ¼n",
            dd: "%d gÃ¼n",
            M: "bir ay",
            MM: "%d ay",
            y: "bir yÄ±l",
            yy: "%d yÄ±l",
          },
          ordinal: function (a) {
            if (0 === a) return a + "'Ä±ncÄ±";
            var c = a % 10,
              d = (a % 100) - c,
              e = a >= 100 ? 100 : null;
            return a + (b[c] || b[d] || b[e]);
          },
          week: { dow: 1, doy: 7 },
        });
      }),
      (function (a) {
        a(tb);
      })(function (a) {
        return a.defineLocale("tzm-latn", {
          months:
            "innayr_brË¤ayrË¤_marË¤sË¤_ibrir_mayyw_ywnyw_ywlywz_É£wÅ¡t_Å¡wtanbir_ktË¤wbrË¤_nwwanbir_dwjnbir".split(
              "_"
            ),
          monthsShort:
            "innayr_brË¤ayrË¤_marË¤sË¤_ibrir_mayyw_ywnyw_ywlywz_É£wÅ¡t_Å¡wtanbir_ktË¤wbrË¤_nwwanbir_dwjnbir".split(
              "_"
            ),
          weekdays: "asamas_aynas_asinas_akras_akwas_asimwas_asiá¸yas".split(
            "_"
          ),
          weekdaysShort:
            "asamas_aynas_asinas_akras_akwas_asimwas_asiá¸yas".split("_"),
          weekdaysMin: "asamas_aynas_asinas_akras_akwas_asimwas_asiá¸yas".split(
            "_"
          ),
          longDateFormat: {
            LT: "HH:mm",
            L: "DD/MM/YYYY",
            LL: "D MMMM YYYY",
            LLL: "D MMMM YYYY LT",
            LLLL: "dddd D MMMM YYYY LT",
          },
          calendar: {
            sameDay: "[asdkh g] LT",
            nextDay: "[aska g] LT",
            nextWeek: "dddd [g] LT",
            lastDay: "[assant g] LT",
            lastWeek: "dddd [g] LT",
            sameElse: "L",
          },
          relativeTime: {
            future: "dadkh s yan %s",
            past: "yan %s",
            s: "imik",
            m: "minuá¸",
            mm: "%d minuá¸",
            h: "saÉ›a",
            hh: "%d tassaÉ›in",
            d: "ass",
            dd: "%d ossan",
            M: "ayowr",
            MM: "%d iyyirn",
            y: "asgas",
            yy: "%d isgasn",
          },
          week: { dow: 6, doy: 12 },
        });
      }),
      (function (a) {
        a(tb);
      })(function (a) {
        return a.defineLocale("tzm", {
          months:
            "âµ‰âµâµâ´°âµ¢âµ”_â´±âµ•â´°âµ¢âµ•_âµŽâ´°âµ•âµš_âµ‰â´±âµ”âµ‰âµ”_âµŽâ´°âµ¢âµ¢âµ“_âµ¢âµ“âµâµ¢âµ“_âµ¢âµ“âµâµ¢âµ“âµ£_âµ–âµ“âµ›âµœ_âµ›âµ“âµœâ´°âµâ´±âµ‰âµ”_â´½âµŸâµ“â´±âµ•_âµâµ“âµ¡â´°âµâ´±âµ‰âµ”_â´·âµ“âµŠâµâ´±âµ‰âµ”".split(
              "_"
            ),
          monthsShort:
            "âµ‰âµâµâ´°âµ¢âµ”_â´±âµ•â´°âµ¢âµ•_âµŽâ´°âµ•âµš_âµ‰â´±âµ”âµ‰âµ”_âµŽâ´°âµ¢âµ¢âµ“_âµ¢âµ“âµâµ¢âµ“_âµ¢âµ“âµâµ¢âµ“âµ£_âµ–âµ“âµ›âµœ_âµ›âµ“âµœâ´°âµâ´±âµ‰âµ”_â´½âµŸâµ“â´±âµ•_âµâµ“âµ¡â´°âµâ´±âµ‰âµ”_â´·âµ“âµŠâµâ´±âµ‰âµ”".split(
              "_"
            ),
          weekdays:
            "â´°âµ™â´°âµŽâ´°âµ™_â´°âµ¢âµâ´°âµ™_â´°âµ™âµ‰âµâ´°âµ™_â´°â´½âµ”â´°âµ™_â´°â´½âµ¡â´°âµ™_â´°âµ™âµ‰âµŽâµ¡â´°âµ™_â´°âµ™âµ‰â´¹âµ¢â´°âµ™".split(
              "_"
            ),
          weekdaysShort:
            "â´°âµ™â´°âµŽâ´°âµ™_â´°âµ¢âµâ´°âµ™_â´°âµ™âµ‰âµâ´°âµ™_â´°â´½âµ”â´°âµ™_â´°â´½âµ¡â´°âµ™_â´°âµ™âµ‰âµŽâµ¡â´°âµ™_â´°âµ™âµ‰â´¹âµ¢â´°âµ™".split(
              "_"
            ),
          weekdaysMin:
            "â´°âµ™â´°âµŽâ´°âµ™_â´°âµ¢âµâ´°âµ™_â´°âµ™âµ‰âµâ´°âµ™_â´°â´½âµ”â´°âµ™_â´°â´½âµ¡â´°âµ™_â´°âµ™âµ‰âµŽâµ¡â´°âµ™_â´°âµ™âµ‰â´¹âµ¢â´°âµ™".split(
              "_"
            ),
          longDateFormat: {
            LT: "HH:mm",
            L: "DD/MM/YYYY",
            LL: "D MMMM YYYY",
            LLL: "D MMMM YYYY LT",
            LLLL: "dddd D MMMM YYYY LT",
          },
          calendar: {
            sameDay: "[â´°âµ™â´·âµ… â´´] LT",
            nextDay: "[â´°âµ™â´½â´° â´´] LT",
            nextWeek: "dddd [â´´] LT",
            lastDay: "[â´°âµšâ´°âµâµœ â´´] LT",
            lastWeek: "dddd [â´´] LT",
            sameElse: "L",
          },
          relativeTime: {
            future: "â´·â´°â´·âµ… âµ™ âµ¢â´°âµ %s",
            past: "âµ¢â´°âµ %s",
            s: "âµ‰âµŽâµ‰â´½",
            m: "âµŽâµ‰âµâµ“â´º",
            mm: "%d âµŽâµ‰âµâµ“â´º",
            h: "âµ™â´°âµ„â´°",
            hh: "%d âµœâ´°âµ™âµ™â´°âµ„âµ‰âµ",
            d: "â´°âµ™âµ™",
            dd: "%d oâµ™âµ™â´°âµ",
            M: "â´°âµ¢oâµ“âµ”",
            MM: "%d âµ‰âµ¢âµ¢âµ‰âµ”âµ",
            y: "â´°âµ™â´³â´°âµ™",
            yy: "%d âµ‰âµ™â´³â´°âµ™âµ",
          },
          week: { dow: 6, doy: 12 },
        });
      }),
      (function (a) {
        a(tb);
      })(function (a) {
        function b(a, b) {
          var c = a.split("_");
          return b % 10 === 1 && b % 100 !== 11
            ? c[0]
            : b % 10 >= 2 && 4 >= b % 10 && (10 > b % 100 || b % 100 >= 20)
            ? c[1]
            : c[2];
        }
        function c(a, c, d) {
          var e = {
            mm: "Ñ…Ð²Ð¸Ð»Ð¸Ð½Ð°_Ñ…Ð²Ð¸Ð»Ð¸Ð½Ð¸_Ñ…Ð²Ð¸Ð»Ð¸Ð½",
            hh: "Ð³Ð¾Ð´Ð¸Ð½Ð°_Ð³Ð¾Ð´Ð¸Ð½Ð¸_Ð³Ð¾Ð´Ð¸Ð½",
            dd: "Ð´ÐµÐ½ÑŒ_Ð´Ð½Ñ–_Ð´Ð½Ñ–Ð²",
            MM: "Ð¼Ñ–ÑÑÑ†ÑŒ_Ð¼Ñ–ÑÑÑ†Ñ–_Ð¼Ñ–ÑÑÑ†Ñ–Ð²",
            yy: "Ñ€Ñ–Ðº_Ñ€Ð¾ÐºÐ¸_Ñ€Ð¾ÐºÑ–Ð²",
          };
          return "m" === d
            ? c
              ? "Ñ…Ð²Ð¸Ð»Ð¸Ð½Ð°"
              : "Ñ…Ð²Ð¸Ð»Ð¸Ð½Ñƒ"
            : "h" === d
            ? c
              ? "Ð³Ð¾Ð´Ð¸Ð½Ð°"
              : "Ð³Ð¾Ð´Ð¸Ð½Ñƒ"
            : a + " " + b(e[d], +a);
        }
        function d(a, b) {
          var c = {
              nominative:
                "ÑÑ–Ñ‡ÐµÐ½ÑŒ_Ð»ÑŽÑ‚Ð¸Ð¹_Ð±ÐµÑ€ÐµÐ·ÐµÐ½ÑŒ_ÐºÐ²Ñ–Ñ‚ÐµÐ½ÑŒ_Ñ‚Ñ€Ð°Ð²ÐµÐ½ÑŒ_Ñ‡ÐµÑ€Ð²ÐµÐ½ÑŒ_Ð»Ð¸Ð¿ÐµÐ½ÑŒ_ÑÐµÑ€Ð¿ÐµÐ½ÑŒ_Ð²ÐµÑ€ÐµÑÐµÐ½ÑŒ_Ð¶Ð¾Ð²Ñ‚ÐµÐ½ÑŒ_Ð»Ð¸ÑÑ‚Ð¾Ð¿Ð°Ð´_Ð³Ñ€ÑƒÐ´ÐµÐ½ÑŒ".split(
                  "_"
                ),
              accusative:
                "ÑÑ–Ñ‡Ð½Ñ_Ð»ÑŽÑ‚Ð¾Ð³Ð¾_Ð±ÐµÑ€ÐµÐ·Ð½Ñ_ÐºÐ²Ñ–Ñ‚Ð½Ñ_Ñ‚Ñ€Ð°Ð²Ð½Ñ_Ñ‡ÐµÑ€Ð²Ð½Ñ_Ð»Ð¸Ð¿Ð½Ñ_ÑÐµÑ€Ð¿Ð½Ñ_Ð²ÐµÑ€ÐµÑÐ½Ñ_Ð¶Ð¾Ð²Ñ‚Ð½Ñ_Ð»Ð¸ÑÑ‚Ð¾Ð¿Ð°Ð´Ð°_Ð³Ñ€ÑƒÐ´Ð½Ñ".split(
                  "_"
                ),
            },
            d = /D[oD]? *MMMM?/.test(b) ? "accusative" : "nominative";
          return c[d][a.month()];
        }
        function e(a, b) {
          var c = {
              nominative:
                "Ð½ÐµÐ´Ñ–Ð»Ñ_Ð¿Ð¾Ð½ÐµÐ´Ñ–Ð»Ð¾Ðº_Ð²Ñ–Ð²Ñ‚Ð¾Ñ€Ð¾Ðº_ÑÐµÑ€ÐµÐ´Ð°_Ñ‡ÐµÑ‚Ð²ÐµÑ€_Ð¿â€™ÑÑ‚Ð½Ð¸Ñ†Ñ_ÑÑƒÐ±Ð¾Ñ‚Ð°".split(
                  "_"
                ),
              accusative:
                "Ð½ÐµÐ´Ñ–Ð»ÑŽ_Ð¿Ð¾Ð½ÐµÐ´Ñ–Ð»Ð¾Ðº_Ð²Ñ–Ð²Ñ‚Ð¾Ñ€Ð¾Ðº_ÑÐµÑ€ÐµÐ´Ñƒ_Ñ‡ÐµÑ‚Ð²ÐµÑ€_Ð¿â€™ÑÑ‚Ð½Ð¸Ñ†ÑŽ_ÑÑƒÐ±Ð¾Ñ‚Ñƒ".split(
                  "_"
                ),
              genitive:
                "Ð½ÐµÐ´Ñ–Ð»Ñ–_Ð¿Ð¾Ð½ÐµÐ´Ñ–Ð»ÐºÐ°_Ð²Ñ–Ð²Ñ‚Ð¾Ñ€ÐºÐ°_ÑÐµÑ€ÐµÐ´Ð¸_Ñ‡ÐµÑ‚Ð²ÐµÑ€Ð³Ð°_Ð¿â€™ÑÑ‚Ð½Ð¸Ñ†Ñ–_ÑÑƒÐ±Ð¾Ñ‚Ð¸".split(
                  "_"
                ),
            },
            d = /(\[[Ð’Ð²Ð£Ñƒ]\]) ?dddd/.test(b)
              ? "accusative"
              : /\[?(?:Ð¼Ð¸Ð½ÑƒÐ»Ð¾Ñ—|Ð½Ð°ÑÑ‚ÑƒÐ¿Ð½Ð¾Ñ—)? ?\] ?dddd/.test(b)
              ? "genitive"
              : "nominative";
          return c[d][a.day()];
        }
        function f(a) {
          return function () {
            return a + "Ð¾" + (11 === this.hours() ? "Ð±" : "") + "] LT";
          };
        }
        return a.defineLocale("uk", {
          months: d,
          monthsShort:
            "ÑÑ–Ñ‡_Ð»ÑŽÑ‚_Ð±ÐµÑ€_ÐºÐ²Ñ–Ñ‚_Ñ‚Ñ€Ð°Ð²_Ñ‡ÐµÑ€Ð²_Ð»Ð¸Ð¿_ÑÐµÑ€Ð¿_Ð²ÐµÑ€_Ð¶Ð¾Ð²Ñ‚_Ð»Ð¸ÑÑ‚_Ð³Ñ€ÑƒÐ´".split(
              "_"
            ),
          weekdays: e,
          weekdaysShort: "Ð½Ð´_Ð¿Ð½_Ð²Ñ‚_ÑÑ€_Ñ‡Ñ‚_Ð¿Ñ‚_ÑÐ±".split("_"),
          weekdaysMin: "Ð½Ð´_Ð¿Ð½_Ð²Ñ‚_ÑÑ€_Ñ‡Ñ‚_Ð¿Ñ‚_ÑÐ±".split("_"),
          longDateFormat: {
            LT: "HH:mm",
            L: "DD.MM.YYYY",
            LL: "D MMMM YYYY Ñ€.",
            LLL: "D MMMM YYYY Ñ€., LT",
            LLLL: "dddd, D MMMM YYYY Ñ€., LT",
          },
          calendar: {
            sameDay: f("[Ð¡ÑŒÐ¾Ð³Ð¾Ð´Ð½Ñ– "),
            nextDay: f("[Ð—Ð°Ð²Ñ‚Ñ€Ð° "),
            lastDay: f("[Ð’Ñ‡Ð¾Ñ€Ð° "),
            nextWeek: f("[Ð£] dddd ["),
            lastWeek: function () {
              switch (this.day()) {
                case 0:
                case 3:
                case 5:
                case 6:
                  return f("[ÐœÐ¸Ð½ÑƒÐ»Ð¾Ñ—] dddd [").call(this);
                case 1:
                case 2:
                case 4:
                  return f("[ÐœÐ¸Ð½ÑƒÐ»Ð¾Ð³Ð¾] dddd [").call(this);
              }
            },
            sameElse: "L",
          },
          relativeTime: {
            future: "Ð·Ð° %s",
            past: "%s Ñ‚Ð¾Ð¼Ñƒ",
            s: "Ð´ÐµÐºÑ–Ð»ÑŒÐºÐ° ÑÐµÐºÑƒÐ½Ð´",
            m: c,
            mm: c,
            h: "Ð³Ð¾Ð´Ð¸Ð½Ñƒ",
            hh: c,
            d: "Ð´ÐµÐ½ÑŒ",
            dd: c,
            M: "Ð¼Ñ–ÑÑÑ†ÑŒ",
            MM: c,
            y: "Ñ€Ñ–Ðº",
            yy: c,
          },
          meridiem: function (a) {
            return 4 > a
              ? "Ð½Ð¾Ñ‡Ñ–"
              : 12 > a
              ? "Ñ€Ð°Ð½ÐºÑƒ"
              : 17 > a
              ? "Ð´Ð½Ñ"
              : "Ð²ÐµÑ‡Ð¾Ñ€Ð°";
          },
          ordinal: function (a, b) {
            switch (b) {
              case "M":
              case "d":
              case "DDD":
              case "w":
              case "W":
                return a + "-Ð¹";
              case "D":
                return a + "-Ð³Ð¾";
              default:
                return a;
            }
          },
          week: { dow: 1, doy: 7 },
        });
      }),
      (function (a) {
        a(tb);
      })(function (a) {
        return a.defineLocale("uz", {
          months:
            "ÑÐ½Ð²Ð°Ñ€ÑŒ_Ñ„ÐµÐ²Ñ€Ð°Ð»ÑŒ_Ð¼Ð°Ñ€Ñ‚_Ð°Ð¿Ñ€ÐµÐ»ÑŒ_Ð¼Ð°Ð¹_Ð¸ÑŽÐ½ÑŒ_Ð¸ÑŽÐ»ÑŒ_Ð°Ð²Ð³ÑƒÑÑ‚_ÑÐµÐ½Ñ‚ÑÐ±Ñ€ÑŒ_Ð¾ÐºÑ‚ÑÐ±Ñ€ÑŒ_Ð½Ð¾ÑÐ±Ñ€ÑŒ_Ð´ÐµÐºÐ°Ð±Ñ€ÑŒ".split(
              "_"
            ),
          monthsShort:
            "ÑÐ½Ð²_Ñ„ÐµÐ²_Ð¼Ð°Ñ€_Ð°Ð¿Ñ€_Ð¼Ð°Ð¹_Ð¸ÑŽÐ½_Ð¸ÑŽÐ»_Ð°Ð²Ð³_ÑÐµÐ½_Ð¾ÐºÑ‚_Ð½Ð¾Ñ_Ð´ÐµÐº".split(
              "_"
            ),
          weekdays:
            "Ð¯ÐºÑˆÐ°Ð½Ð±Ð°_Ð”ÑƒÑˆÐ°Ð½Ð±Ð°_Ð¡ÐµÑˆÐ°Ð½Ð±Ð°_Ð§Ð¾Ñ€ÑˆÐ°Ð½Ð±Ð°_ÐŸÐ°Ð¹ÑˆÐ°Ð½Ð±Ð°_Ð–ÑƒÐ¼Ð°_Ð¨Ð°Ð½Ð±Ð°".split(
              "_"
            ),
          weekdaysShort:
            "Ð¯ÐºÑˆ_Ð”ÑƒÑˆ_Ð¡ÐµÑˆ_Ð§Ð¾Ñ€_ÐŸÐ°Ð¹_Ð–ÑƒÐ¼_Ð¨Ð°Ð½".split("_"),
          weekdaysMin: "Ð¯Ðº_Ð”Ñƒ_Ð¡Ðµ_Ð§Ð¾_ÐŸÐ°_Ð–Ñƒ_Ð¨Ð°".split("_"),
          longDateFormat: {
            LT: "HH:mm",
            L: "DD/MM/YYYY",
            LL: "D MMMM YYYY",
            LLL: "D MMMM YYYY LT",
            LLLL: "D MMMM YYYY, dddd LT",
          },
          calendar: {
            sameDay: "[Ð‘ÑƒÐ³ÑƒÐ½ ÑÐ¾Ð°Ñ‚] LT [Ð´Ð°]",
            nextDay: "[Ð­Ñ€Ñ‚Ð°Ð³Ð°] LT [Ð´Ð°]",
            nextWeek: "dddd [ÐºÑƒÐ½Ð¸ ÑÐ¾Ð°Ñ‚] LT [Ð´Ð°]",
            lastDay: "[ÐšÐµÑ‡Ð° ÑÐ¾Ð°Ñ‚] LT [Ð´Ð°]",
            lastWeek: "[Ð£Ñ‚Ð³Ð°Ð½] dddd [ÐºÑƒÐ½Ð¸ ÑÐ¾Ð°Ñ‚] LT [Ð´Ð°]",
            sameElse: "L",
          },
          relativeTime: {
            future: "Ð¯ÐºÐ¸Ð½ %s Ð¸Ñ‡Ð¸Ð´Ð°",
            past: "Ð‘Ð¸Ñ€ Ð½ÐµÑ‡Ð° %s Ð¾Ð»Ð´Ð¸Ð½",
            s: "Ñ„ÑƒÑ€ÑÐ°Ñ‚",
            m: "Ð±Ð¸Ñ€ Ð´Ð°ÐºÐ¸ÐºÐ°",
            mm: "%d Ð´Ð°ÐºÐ¸ÐºÐ°",
            h: "Ð±Ð¸Ñ€ ÑÐ¾Ð°Ñ‚",
            hh: "%d ÑÐ¾Ð°Ñ‚",
            d: "Ð±Ð¸Ñ€ ÐºÑƒÐ½",
            dd: "%d ÐºÑƒÐ½",
            M: "Ð±Ð¸Ñ€ Ð¾Ð¹",
            MM: "%d Ð¾Ð¹",
            y: "Ð±Ð¸Ñ€ Ð¹Ð¸Ð»",
            yy: "%d Ð¹Ð¸Ð»",
          },
          week: { dow: 1, doy: 7 },
        });
      }),
      (function (a) {
        a(tb);
      })(function (a) {
        return a.defineLocale("vi", {
          months:
            "thÃ¡ng 1_thÃ¡ng 2_thÃ¡ng 3_thÃ¡ng 4_thÃ¡ng 5_thÃ¡ng 6_thÃ¡ng 7_thÃ¡ng 8_thÃ¡ng 9_thÃ¡ng 10_thÃ¡ng 11_thÃ¡ng 12".split(
              "_"
            ),
          monthsShort:
            "Th01_Th02_Th03_Th04_Th05_Th06_Th07_Th08_Th09_Th10_Th11_Th12".split(
              "_"
            ),
          weekdays:
            "chá»§ nháº­t_thá»© hai_thá»© ba_thá»© tÆ°_thá»© nÄƒm_thá»© sÃ¡u_thá»© báº£y".split(
              "_"
            ),
          weekdaysShort: "CN_T2_T3_T4_T5_T6_T7".split("_"),
          weekdaysMin: "CN_T2_T3_T4_T5_T6_T7".split("_"),
          longDateFormat: {
            LT: "HH:mm",
            L: "DD/MM/YYYY",
            LL: "D MMMM [nÄƒm] YYYY",
            LLL: "D MMMM [nÄƒm] YYYY LT",
            LLLL: "dddd, D MMMM [nÄƒm] YYYY LT",
            l: "DD/M/YYYY",
            ll: "D MMM YYYY",
            lll: "D MMM YYYY LT",
            llll: "ddd, D MMM YYYY LT",
          },
          calendar: {
            sameDay: "[HÃ´m nay lÃºc] LT",
            nextDay: "[NgÃ y mai lÃºc] LT",
            nextWeek: "dddd [tuáº§n tá»›i lÃºc] LT",
            lastDay: "[HÃ´m qua lÃºc] LT",
            lastWeek: "dddd [tuáº§n rá»“i lÃºc] LT",
            sameElse: "L",
          },
          relativeTime: {
            future: "%s tá»›i",
            past: "%s trÆ°á»›c",
            s: "vÃ i giÃ¢y",
            m: "má»™t phÃºt",
            mm: "%d phÃºt",
            h: "má»™t giá»",
            hh: "%d giá»",
            d: "má»™t ngÃ y",
            dd: "%d ngÃ y",
            M: "má»™t thÃ¡ng",
            MM: "%d thÃ¡ng",
            y: "má»™t nÄƒm",
            yy: "%d nÄƒm",
          },
          ordinal: function (a) {
            return a;
          },
          week: { dow: 1, doy: 4 },
        });
      }),
      (function (a) {
        a(tb);
      })(function (a) {
        return a.defineLocale("zh-cn", {
          months:
            "ä¸€æœˆ_äºŒæœˆ_ä¸‰æœˆ_å››æœˆ_äº”æœˆ_å…­æœˆ_ä¸ƒæœˆ_å…«æœˆ_ä¹æœˆ_åæœˆ_åä¸€æœˆ_åäºŒæœˆ".split(
              "_"
            ),
          monthsShort:
            "1æœˆ_2æœˆ_3æœˆ_4æœˆ_5æœˆ_6æœˆ_7æœˆ_8æœˆ_9æœˆ_10æœˆ_11æœˆ_12æœˆ".split(
              "_"
            ),
          weekdays:
            "æ˜ŸæœŸæ—¥_æ˜ŸæœŸä¸€_æ˜ŸæœŸäºŒ_æ˜ŸæœŸä¸‰_æ˜ŸæœŸå››_æ˜ŸæœŸäº”_æ˜ŸæœŸå…­".split(
              "_"
            ),
          weekdaysShort:
            "å‘¨æ—¥_å‘¨ä¸€_å‘¨äºŒ_å‘¨ä¸‰_å‘¨å››_å‘¨äº”_å‘¨å…­".split("_"),
          weekdaysMin: "æ—¥_ä¸€_äºŒ_ä¸‰_å››_äº”_å…­".split("_"),
          longDateFormat: {
            LT: "Ahç‚¹mm",
            L: "YYYY-MM-DD",
            LL: "YYYYå¹´MMMDæ—¥",
            LLL: "YYYYå¹´MMMDæ—¥LT",
            LLLL: "YYYYå¹´MMMDæ—¥ddddLT",
            l: "YYYY-MM-DD",
            ll: "YYYYå¹´MMMDæ—¥",
            lll: "YYYYå¹´MMMDæ—¥LT",
            llll: "YYYYå¹´MMMDæ—¥ddddLT",
          },
          meridiem: function (a, b) {
            var c = 100 * a + b;
            return 600 > c
              ? "å‡Œæ™¨"
              : 900 > c
              ? "æ—©ä¸Š"
              : 1130 > c
              ? "ä¸Šåˆ"
              : 1230 > c
              ? "ä¸­åˆ"
              : 1800 > c
              ? "ä¸‹åˆ"
              : "æ™šä¸Š";
          },
          calendar: {
            sameDay: function () {
              return 0 === this.minutes() ? "[ä»Šå¤©]Ah[ç‚¹æ•´]" : "[ä»Šå¤©]LT";
            },
            nextDay: function () {
              return 0 === this.minutes() ? "[æ˜Žå¤©]Ah[ç‚¹æ•´]" : "[æ˜Žå¤©]LT";
            },
            lastDay: function () {
              return 0 === this.minutes() ? "[æ˜¨å¤©]Ah[ç‚¹æ•´]" : "[æ˜¨å¤©]LT";
            },
            nextWeek: function () {
              var b, c;
              return (
                (b = a().startOf("week")),
                (c = this.unix() - b.unix() >= 604800 ? "[ä¸‹]" : "[æœ¬]"),
                0 === this.minutes() ? c + "dddAhç‚¹æ•´" : c + "dddAhç‚¹mm"
              );
            },
            lastWeek: function () {
              var b, c;
              return (
                (b = a().startOf("week")),
                (c = this.unix() < b.unix() ? "[ä¸Š]" : "[æœ¬]"),
                0 === this.minutes() ? c + "dddAhç‚¹æ•´" : c + "dddAhç‚¹mm"
              );
            },
            sameElse: "LL",
          },
          ordinal: function (a, b) {
            switch (b) {
              case "d":
              case "D":
              case "DDD":
                return a + "æ—¥";
              case "M":
                return a + "æœˆ";
              case "w":
              case "W":
                return a + "å‘¨";
              default:
                return a;
            }
          },
          relativeTime: {
            future: "%så†…",
            past: "%så‰",
            s: "å‡ ç§’",
            m: "1åˆ†é’Ÿ",
            mm: "%dåˆ†é’Ÿ",
            h: "1å°æ—¶",
            hh: "%då°æ—¶",
            d: "1å¤©",
            dd: "%då¤©",
            M: "1ä¸ªæœˆ",
            MM: "%dä¸ªæœˆ",
            y: "1å¹´",
            yy: "%då¹´",
          },
          week: { dow: 1, doy: 4 },
        });
      }),
      (function (a) {
        a(tb);
      })(function (a) {
        return a.defineLocale("zh-tw", {
          months:
            "ä¸€æœˆ_äºŒæœˆ_ä¸‰æœˆ_å››æœˆ_äº”æœˆ_å…­æœˆ_ä¸ƒæœˆ_å…«æœˆ_ä¹æœˆ_åæœˆ_åä¸€æœˆ_åäºŒæœˆ".split(
              "_"
            ),
          monthsShort:
            "1æœˆ_2æœˆ_3æœˆ_4æœˆ_5æœˆ_6æœˆ_7æœˆ_8æœˆ_9æœˆ_10æœˆ_11æœˆ_12æœˆ".split(
              "_"
            ),
          weekdays:
            "æ˜ŸæœŸæ—¥_æ˜ŸæœŸä¸€_æ˜ŸæœŸäºŒ_æ˜ŸæœŸä¸‰_æ˜ŸæœŸå››_æ˜ŸæœŸäº”_æ˜ŸæœŸå…­".split(
              "_"
            ),
          weekdaysShort:
            "é€±æ—¥_é€±ä¸€_é€±äºŒ_é€±ä¸‰_é€±å››_é€±äº”_é€±å…­".split("_"),
          weekdaysMin: "æ—¥_ä¸€_äºŒ_ä¸‰_å››_äº”_å…­".split("_"),
          longDateFormat: {
            LT: "Ahé»žmm",
            L: "YYYYå¹´MMMDæ—¥",
            LL: "YYYYå¹´MMMDæ—¥",
            LLL: "YYYYå¹´MMMDæ—¥LT",
            LLLL: "YYYYå¹´MMMDæ—¥ddddLT",
            l: "YYYYå¹´MMMDæ—¥",
            ll: "YYYYå¹´MMMDæ—¥",
            lll: "YYYYå¹´MMMDæ—¥LT",
            llll: "YYYYå¹´MMMDæ—¥ddddLT",
          },
          meridiem: function (a, b) {
            var c = 100 * a + b;
            return 900 > c
              ? "æ—©ä¸Š"
              : 1130 > c
              ? "ä¸Šåˆ"
              : 1230 > c
              ? "ä¸­åˆ"
              : 1800 > c
              ? "ä¸‹åˆ"
              : "æ™šä¸Š";
          },
          calendar: {
            sameDay: "[ä»Šå¤©]LT",
            nextDay: "[æ˜Žå¤©]LT",
            nextWeek: "[ä¸‹]ddddLT",
            lastDay: "[æ˜¨å¤©]LT",
            lastWeek: "[ä¸Š]ddddLT",
            sameElse: "L",
          },
          ordinal: function (a, b) {
            switch (b) {
              case "d":
              case "D":
              case "DDD":
                return a + "æ—¥";
              case "M":
                return a + "æœˆ";
              case "w":
              case "W":
                return a + "é€±";
              default:
                return a;
            }
          },
          relativeTime: {
            future: "%så…§",
            past: "%så‰",
            s: "å¹¾ç§’",
            m: "ä¸€åˆ†é˜",
            mm: "%dåˆ†é˜",
            h: "ä¸€å°æ™‚",
            hh: "%då°æ™‚",
            d: "ä¸€å¤©",
            dd: "%då¤©",
            M: "ä¸€å€‹æœˆ",
            MM: "%då€‹æœˆ",
            y: "ä¸€å¹´",
            yy: "%då¹´",
          },
        });
      }),
      tb.locale("en"),
      Jb
        ? (module.exports = tb)
        : "function" == typeof define && define.amd
        ? (define("moment", function (a, b, c) {
            return (
              c.config &&
                c.config() &&
                c.config().noGlobal === !0 &&
                (xb.moment = ub),
              tb
            );
          }),
          sb(!0))
        : sb();
  }).call(this);
  window.moment = this.moment;
  (function (moment) {
    !(function (moment) {
      var regex =
        /P((([0-9]*\.?[0-9])Y)?(([0-9]*\.?[0-9])M)?(([0-9]*\.?[0-9])W)?(([0-9]*\.?[0-9])D)?)?(T(([0-9]*\.?[0-9])H)?(([0-9]*\.?[0-9])M)?(([0-9]*\.?[0-9])S)?)?/;
      moment.duration.fromIsoduration = function (duration) {
        var matches = duration.match(regex);
        return moment.duration({
          years: parseFloat(matches[3]),
          months: parseFloat(matches[5]),
          weeks: parseFloat(matches[7]),
          days: parseFloat(matches[9]),
          hours: parseFloat(matches[12]),
          minutes: parseFloat(matches[14]),
          seconds: parseFloat(matches[16]),
        });
      };
      moment.duration.fn.isoduration = function () {
        var duration =
          "P" +
          (this.years() ? this.years() + "Y" : "") +
          (this.months() ? this.months() + "M" : "") +
          (this.days() ? this.days() + "D" : "") +
          (this.hours() || this.minutes() || this.seconds() ? "T" : "") +
          (this.hours() ? this.hours() + "H" : "") +
          (this.minutes() ? this.minutes() + "M" : "") +
          (this.seconds() ? this.seconds() + "S" : "");
        return duration;
      };
    })(moment);
  }).call(this, this.moment);
  /*!
   * Globalize
   *
   * http://github.com/jquery/globalize
   *
   * Copyright Software Freedom Conservancy, Inc.
   * Dual licensed under the MIT or GPL Version 2 licenses.
   * http://jquery.org/license
   */

  (function (window, undefined) {
    var Globalize,
      // private variables
      regexHex,
      regexInfinity,
      regexParseFloat,
      regexTrim,
      // private JavaScript utility functions
      arrayIndexOf,
      endsWith,
      extend,
      isArray,
      isFunction,
      isObject,
      startsWith,
      trim,
      truncate,
      zeroPad,
      // private Globalization utility functions
      appendPreOrPostMatch,
      expandFormat,
      formatDate,
      formatNumber,
      getTokenRegExp,
      getEra,
      getEraYear,
      parseExact,
      parseNegativePattern;

    // Global variable (Globalize) or CommonJS module (globalize)
    Globalize = function (cultureSelector) {
      return new Globalize.prototype.init(cultureSelector);
    };

    if (
      typeof require !== "undefined" &&
      typeof exports !== "undefined" &&
      typeof module !== "undefined"
    ) {
      // Assume CommonJS
      module.exports = Globalize;
    } else {
      // Export as global variable
      window.Globalize = Globalize;
    }

    Globalize.cultures = {};

    Globalize.prototype = {
      constructor: Globalize,
      init: function (cultureSelector) {
        this.cultures = Globalize.cultures;
        this.cultureSelector = cultureSelector;

        return this;
      },
    };
    Globalize.prototype.init.prototype = Globalize.prototype;

    // 1. When defining a culture, all fields are required except the ones stated as optional.
    // 2. Each culture should have a ".calendars" object with at least one calendar named "standard"
    //    which serves as the default calendar in use by that culture.
    // 3. Each culture should have a ".calendar" object which is the current calendar being used,
    //    it may be dynamically changed at any time to one of the calendars in ".calendars".
    Globalize.cultures["default"] = {
      // A unique name for the culture in the form <language code>-<country/region code>
      name: "en",
      // the name of the culture in the english language
      englishName: "English",
      // the name of the culture in its own language
      nativeName: "English",
      // whether the culture uses right-to-left text
      isRTL: false,
      // "language" is used for so-called "specific" cultures.
      // For example, the culture "es-CL" means "Spanish, in Chili".
      // It represents the Spanish-speaking culture as it is in Chili,
      // which might have different formatting rules or even translations
      // than Spanish in Spain. A "neutral" culture is one that is not
      // specific to a region. For example, the culture "es" is the generic
      // Spanish culture, which may be a more generalized version of the language
      // that may or may not be what a specific culture expects.
      // For a specific culture like "es-CL", the "language" field refers to the
      // neutral, generic culture information for the language it is using.
      // This is not always a simple matter of the string before the dash.
      // For example, the "zh-Hans" culture is netural (Simplified Chinese).
      // And the "zh-SG" culture is Simplified Chinese in Singapore, whose lanugage
      // field is "zh-CHS", not "zh".
      // This field should be used to navigate from a specific culture to it's
      // more general, neutral culture. If a culture is already as general as it
      // can get, the language may refer to itself.
      language: "en",
      // numberFormat defines general number formatting rules, like the digits in
      // each grouping, the group separator, and how negative numbers are displayed.
      numberFormat: {
        // [negativePattern]
        // Note, numberFormat.pattern has no "positivePattern" unlike percent and currency,
        // but is still defined as an array for consistency with them.
        //   negativePattern: one of "(n)|-n|- n|n-|n -"
        pattern: ["-n"],
        // number of decimal places normally shown
        decimals: 2,
        // string that separates number groups, as in 1,000,000
        ",": ",",
        // string that separates a number from the fractional portion, as in 1.99
        ".": ".",
        // array of numbers indicating the size of each number group.
        // TODO: more detailed description and example
        groupSizes: [3],
        // symbol used for positive numbers
        "+": "+",
        // symbol used for negative numbers
        "-": "-",
        // symbol used for NaN (Not-A-Number)
        NaN: "NaN",
        // symbol used for Negative Infinity
        negativeInfinity: "-Infinity",
        // symbol used for Positive Infinity
        positiveInfinity: "Infinity",
        percent: {
          // [negativePattern, positivePattern]
          //   negativePattern: one of "-n %|-n%|-%n|%-n|%n-|n-%|n%-|-% n|n %-|% n-|% -n|n- %"
          //   positivePattern: one of "n %|n%|%n|% n"
          pattern: ["-n %", "n %"],
          // number of decimal places normally shown
          decimals: 2,
          // array of numbers indicating the size of each number group.
          // TODO: more detailed description and example
          groupSizes: [3],
          // string that separates number groups, as in 1,000,000
          ",": ",",
          // string that separates a number from the fractional portion, as in 1.99
          ".": ".",
          // symbol used to represent a percentage
          symbol: "%",
        },
        currency: {
          // [negativePattern, positivePattern]
          //   negativePattern: one of "($n)|-$n|$-n|$n-|(n$)|-n$|n-$|n$-|-n $|-$ n|n $-|$ n-|$ -n|n- $|($ n)|(n $)"
          //   positivePattern: one of "$n|n$|$ n|n $"
          pattern: ["($n)", "$n"],
          // number of decimal places normally shown
          decimals: 2,
          // array of numbers indicating the size of each number group.
          // TODO: more detailed description and example
          groupSizes: [3],
          // string that separates number groups, as in 1,000,000
          ",": ",",
          // string that separates a number from the fractional portion, as in 1.99
          ".": ".",
          // symbol used to represent currency
          symbol: "$",
        },
      },
      // calendars defines all the possible calendars used by this culture.
      // There should be at least one defined with name "standard", and is the default
      // calendar used by the culture.
      // A calendar contains information about how dates are formatted, information about
      // the calendar's eras, a standard set of the date formats,
      // translations for day and month names, and if the calendar is not based on the Gregorian
      // calendar, conversion functions to and from the Gregorian calendar.
      calendars: {
        standard: {
          // name that identifies the type of calendar this is
          name: "Gregorian_USEnglish",
          // separator of parts of a date (e.g. "/" in 11/05/1955)
          "/": "/",
          // separator of parts of a time (e.g. ":" in 05:44 PM)
          ":": ":",
          // the first day of the week (0 = Sunday, 1 = Monday, etc)
          firstDay: 0,
          days: {
            // full day names
            names: [
              "Sunday",
              "Monday",
              "Tuesday",
              "Wednesday",
              "Thursday",
              "Friday",
              "Saturday",
            ],
            // abbreviated day names
            namesAbbr: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
            // shortest day names
            namesShort: ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"],
          },
          months: {
            // full month names (13 months for lunar calendards -- 13th month should be "" if not lunar)
            names: [
              "January",
              "February",
              "March",
              "April",
              "May",
              "June",
              "July",
              "August",
              "September",
              "October",
              "November",
              "December",
              "",
            ],
            // abbreviated month names
            namesAbbr: [
              "Jan",
              "Feb",
              "Mar",
              "Apr",
              "May",
              "Jun",
              "Jul",
              "Aug",
              "Sep",
              "Oct",
              "Nov",
              "Dec",
              "",
            ],
          },
          // AM and PM designators in one of these forms:
          // The usual view, and the upper and lower case versions
          //   [ standard, lowercase, uppercase ]
          // The culture does not use AM or PM (likely all standard date formats use 24 hour time)
          //   null
          AM: ["AM", "am", "AM"],
          PM: ["PM", "pm", "PM"],
          eras: [
            // eras in reverse chronological order.
            // name: the name of the era in this culture (e.g. A.D., C.E.)
            // start: when the era starts in ticks (gregorian, gmt), null if it is the earliest supported era.
            // offset: offset in years from gregorian calendar
            {
              name: "A.D.",
              start: null,
              offset: 0,
            },
          ],
          // when a two digit year is given, it will never be parsed as a four digit
          // year greater than this year (in the appropriate era for the culture)
          // Set it as a full year (e.g. 2029) or use an offset format starting from
          // the current year: "+19" would correspond to 2029 if the current year 2010.
          twoDigitYearMax: 2029,
          // set of predefined date and time patterns used by the culture
          // these represent the format someone in this culture would expect
          // to see given the portions of the date that are shown.
          patterns: {
            // short date pattern
            d: "M/d/yyyy",
            // long date pattern
            D: "dddd, MMMM dd, yyyy",
            // short time pattern
            t: "h:mm tt",
            // long time pattern
            T: "h:mm:ss tt",
            // long date, short time pattern
            f: "dddd, MMMM dd, yyyy h:mm tt",
            // long date, long time pattern
            F: "dddd, MMMM dd, yyyy h:mm:ss tt",
            // month/day pattern
            M: "MMMM dd",
            // month/year pattern
            Y: "yyyy MMMM",
            // S is a sortable format that does not vary by culture
            S: "yyyy\u0027-\u0027MM\u0027-\u0027dd\u0027T\u0027HH\u0027:\u0027mm\u0027:\u0027ss",
          },
          // optional fields for each calendar:
          /*
			monthsGenitive:
				Same as months but used when the day preceeds the month.
				Omit if the culture has no genitive distinction in month names.
				For an explaination of genitive months, see http://blogs.msdn.com/michkap/archive/2004/12/25/332259.aspx
			convert:
				Allows for the support of non-gregorian based calendars. This convert object is used to
				to convert a date to and from a gregorian calendar date to handle parsing and formatting.
				The two functions:
					fromGregorian( date )
						Given the date as a parameter, return an array with parts [ year, month, day ]
						corresponding to the non-gregorian based year, month, and day for the calendar.
					toGregorian( year, month, day )
						Given the non-gregorian year, month, and day, return a new Date() object
						set to the corresponding date in the gregorian calendar.
			*/
        },
      },
      // For localized strings
      messages: {},
    };

    Globalize.cultures["default"].calendar =
      Globalize.cultures["default"].calendars.standard;

    Globalize.cultures.en = Globalize.cultures["default"];

    Globalize.cultureSelector = "en";

    //
    // private variables
    //

    regexHex = /^0x[a-f0-9]+$/i;
    regexInfinity = /^[+\-]?infinity$/i;
    regexParseFloat = /^[+\-]?\d*\.?\d*(e[+\-]?\d+)?$/;
    regexTrim = /^\s+|\s+$/g;

    //
    // private JavaScript utility functions
    //

    arrayIndexOf = function (array, item) {
      if (array.indexOf) {
        return array.indexOf(item);
      }
      for (var i = 0, length = array.length; i < length; i++) {
        if (array[i] === item) {
          return i;
        }
      }
      return -1;
    };

    endsWith = function (value, pattern) {
      return value.substr(value.length - pattern.length) === pattern;
    };

    extend = function () {
      var options,
        name,
        src,
        copy,
        copyIsArray,
        clone,
        target = arguments[0] || {},
        i = 1,
        length = arguments.length,
        deep = false;

      // Handle a deep copy situation
      if (typeof target === "boolean") {
        deep = target;
        target = arguments[1] || {};
        // skip the boolean and the target
        i = 2;
      }

      // Handle case when target is a string or something (possible in deep copy)
      if (typeof target !== "object" && !isFunction(target)) {
        target = {};
      }

      for (; i < length; i++) {
        // Only deal with non-null/undefined values
        if ((options = arguments[i]) != null) {
          // Extend the base object
          for (name in options) {
            src = target[name];
            copy = options[name];

            // Prevent never-ending loop
            if (target === copy) {
              continue;
            }

            // Recurse if we're merging plain objects or arrays
            if (
              deep &&
              copy &&
              (isObject(copy) || (copyIsArray = isArray(copy)))
            ) {
              if (copyIsArray) {
                copyIsArray = false;
                clone = src && isArray(src) ? src : [];
              } else {
                clone = src && isObject(src) ? src : {};
              }

              // Never move original objects, clone them
              target[name] = extend(deep, clone, copy);

              // Don't bring in undefined values
            } else if (copy !== undefined) {
              target[name] = copy;
            }
          }
        }
      }

      // Return the modified object
      return target;
    };

    isArray =
      Array.isArray ||
      function (obj) {
        return Object.prototype.toString.call(obj) === "[object Array]";
      };

    isFunction = function (obj) {
      return Object.prototype.toString.call(obj) === "[object Function]";
    };

    isObject = function (obj) {
      return Object.prototype.toString.call(obj) === "[object Object]";
    };

    startsWith = function (value, pattern) {
      return value.indexOf(pattern) === 0;
    };

    trim = function (value) {
      return (value + "").replace(regexTrim, "");
    };

    truncate = function (value) {
      if (isNaN(value)) {
        return NaN;
      }
      return Math[value < 0 ? "ceil" : "floor"](value);
    };

    zeroPad = function (str, count, left) {
      var l;
      for (l = str.length; l < count; l += 1) {
        str = left ? "0" + str : str + "0";
      }
      return str;
    };

    //
    // private Globalization utility functions
    //

    appendPreOrPostMatch = function (preMatch, strings) {
      // appends pre- and post- token match strings while removing escaped characters.
      // Returns a single quote count which is used to determine if the token occurs
      // in a string literal.
      var quoteCount = 0,
        escaped = false;
      for (var i = 0, il = preMatch.length; i < il; i++) {
        var c = preMatch.charAt(i);
        switch (c) {
          case "'":
            if (escaped) {
              strings.push("'");
            } else {
              quoteCount++;
            }
            escaped = false;
            break;
          case "\\":
            if (escaped) {
              strings.push("\\");
            }
            escaped = !escaped;
            break;
          default:
            strings.push(c);
            escaped = false;
            break;
        }
      }
      return quoteCount;
    };

    expandFormat = function (cal, format) {
      // expands unspecified or single character date formats into the full pattern.
      format = format || "F";
      var pattern,
        patterns = cal.patterns,
        len = format.length;
      if (len === 1) {
        pattern = patterns[format];
        if (!pattern) {
          throw "Invalid date format string '" + format + "'.";
        }
        format = pattern;
      } else if (len === 2 && format.charAt(0) === "%") {
        // %X escape format -- intended as a custom format string that is only one character, not a built-in format.
        format = format.charAt(1);
      }
      return format;
    };

    formatDate = function (value, format, culture) {
      var cal = culture.calendar,
        convert = cal.convert,
        ret;

      if (!format || !format.length || format === "i") {
        if (culture && culture.name.length) {
          if (convert) {
            // non-gregorian calendar, so we cannot use built-in toLocaleString()
            ret = formatDate(value, cal.patterns.F, culture);
          } else {
            var eraDate = new Date(value.getTime()),
              era = getEra(value, cal.eras);
            eraDate.setFullYear(getEraYear(value, cal, era));
            ret = eraDate.toLocaleString();
          }
        } else {
          ret = value.toString();
        }
        return ret;
      }

      var eras = cal.eras,
        sortable = format === "s";
      format = expandFormat(cal, format);

      // Start with an empty string
      ret = [];
      var hour,
        zeros = ["0", "00", "000"],
        foundDay,
        checkedDay,
        dayPartRegExp = /([^d]|^)(d|dd)([^d]|$)/g,
        quoteCount = 0,
        tokenRegExp = getTokenRegExp(),
        converted;

      function padZeros(num, c) {
        var r,
          s = num + "";
        if (c > 1 && s.length < c) {
          r = zeros[c - 2] + s;
          return r.substr(r.length - c, c);
        } else {
          r = s;
        }
        return r;
      }

      function hasDay() {
        if (foundDay || checkedDay) {
          return foundDay;
        }
        foundDay = dayPartRegExp.test(format);
        checkedDay = true;
        return foundDay;
      }

      function getPart(date, part) {
        if (converted) {
          return converted[part];
        }
        switch (part) {
          case 0:
            return date.getFullYear();
          case 1:
            return date.getMonth();
          case 2:
            return date.getDate();
          default:
            throw "Invalid part value " + part;
        }
      }

      if (!sortable && convert) {
        converted = convert.fromGregorian(value);
      }

      for (;;) {
        // Save the current index
        var index = tokenRegExp.lastIndex,
          // Look for the next pattern
          ar = tokenRegExp.exec(format);

        // Append the text before the pattern (or the end of the string if not found)
        var preMatch = format.slice(index, ar ? ar.index : format.length);
        quoteCount += appendPreOrPostMatch(preMatch, ret);

        if (!ar) {
          break;
        }

        // do not replace any matches that occur inside a string literal.
        if (quoteCount % 2) {
          ret.push(ar[0]);
          continue;
        }

        var current = ar[0],
          clength = current.length;

        switch (current) {
          case "ddd":
          //Day of the week, as a three-letter abbreviation
          case "dddd":
            // Day of the week, using the full name
            var names = clength === 3 ? cal.days.namesAbbr : cal.days.names;
            ret.push(names[value.getDay()]);
            break;
          case "d":
          // Day of month, without leading zero for single-digit days
          case "dd":
            // Day of month, with leading zero for single-digit days
            foundDay = true;
            ret.push(padZeros(getPart(value, 2), clength));
            break;
          case "MMM":
          // Month, as a three-letter abbreviation
          case "MMMM":
            // Month, using the full name
            var part = getPart(value, 1);
            ret.push(
              cal.monthsGenitive && hasDay()
                ? cal.monthsGenitive[clength === 3 ? "namesAbbr" : "names"][
                    part
                  ]
                : cal.months[clength === 3 ? "namesAbbr" : "names"][part]
            );
            break;
          case "M":
          // Month, as digits, with no leading zero for single-digit months
          case "MM":
            // Month, as digits, with leading zero for single-digit months
            ret.push(padZeros(getPart(value, 1) + 1, clength));
            break;
          case "y":
          // Year, as two digits, but with no leading zero for years less than 10
          case "yy":
          // Year, as two digits, with leading zero for years less than 10
          case "yyyy":
            // Year represented by four full digits
            part = converted
              ? converted[0]
              : getEraYear(value, cal, getEra(value, eras), sortable);
            if (clength < 4) {
              part = part % 100;
            }
            ret.push(padZeros(part, clength));
            break;
          case "h":
          // Hours with no leading zero for single-digit hours, using 12-hour clock
          case "hh":
            // Hours with leading zero for single-digit hours, using 12-hour clock
            hour = value.getHours() % 12;
            if (hour === 0) hour = 12;
            ret.push(padZeros(hour, clength));
            break;
          case "H":
          // Hours with no leading zero for single-digit hours, using 24-hour clock
          case "HH":
            // Hours with leading zero for single-digit hours, using 24-hour clock
            ret.push(padZeros(value.getHours(), clength));
            break;
          case "m":
          // Minutes with no leading zero for single-digit minutes
          case "mm":
            // Minutes with leading zero for single-digit minutes
            ret.push(padZeros(value.getMinutes(), clength));
            break;
          case "s":
          // Seconds with no leading zero for single-digit seconds
          case "ss":
            // Seconds with leading zero for single-digit seconds
            ret.push(padZeros(value.getSeconds(), clength));
            break;
          case "t":
          // One character am/pm indicator ("a" or "p")
          case "tt":
            // Multicharacter am/pm indicator
            part =
              value.getHours() < 12
                ? cal.AM
                  ? cal.AM[0]
                  : " "
                : cal.PM
                ? cal.PM[0]
                : " ";
            ret.push(clength === 1 ? part.charAt(0) : part);
            break;
          case "f":
          // Deciseconds
          case "ff":
          // Centiseconds
          case "fff":
            // Milliseconds
            ret.push(padZeros(value.getMilliseconds(), 3).substr(0, clength));
            break;
          case "z":
          // Time zone offset, no leading zero
          case "zz":
            // Time zone offset with leading zero
            hour = value.getTimezoneOffset() / 60;
            ret.push(
              (hour <= 0 ? "+" : "-") +
                padZeros(Math.floor(Math.abs(hour)), clength)
            );
            break;
          case "zzz":
            // Time zone offset with leading zero
            hour = value.getTimezoneOffset() / 60;
            ret.push(
              (hour <= 0 ? "+" : "-") +
                padZeros(Math.floor(Math.abs(hour)), 2) +
                // Hard coded ":" separator, rather than using cal.TimeSeparator
                // Repeated here for consistency, plus ":" was already assumed in date parsing.
                ":" +
                padZeros(Math.abs(value.getTimezoneOffset() % 60), 2)
            );
            break;
          case "g":
          case "gg":
            if (cal.eras) {
              ret.push(cal.eras[getEra(value, eras)].name);
            }
            break;
          case "/":
            ret.push(cal["/"]);
            break;
          default:
            throw "Invalid date format pattern '" + current + "'.";
        }
      }
      return ret.join("");
    };

    // formatNumber
    (function () {
      var expandNumber;

      expandNumber = function (number, precision, formatInfo) {
        var groupSizes = formatInfo.groupSizes,
          curSize = groupSizes[0],
          curGroupIndex = 1,
          factor = Math.pow(10, precision),
          rounded = Math.round(number * factor) / factor;

        if (!isFinite(rounded)) {
          rounded = number;
        }
        number = rounded;

        var numberString = number + "",
          right = "",
          split = numberString.split(/e/i),
          exponent = split.length > 1 ? parseInt(split[1], 10) : 0;
        numberString = split[0];
        split = numberString.split(".");
        numberString = split[0];
        right = split.length > 1 ? split[1] : "";

        if (exponent > 0) {
          right = zeroPad(right, exponent, false);
          numberString += right.slice(0, exponent);
          right = right.substr(exponent);
        } else if (exponent < 0) {
          exponent = -exponent;
          numberString = zeroPad(numberString, exponent + 1, true);
          right = numberString.slice(-exponent, numberString.length) + right;
          numberString = numberString.slice(0, -exponent);
        }

        if (precision > 0) {
          right =
            formatInfo["."] +
            (right.length > precision
              ? right.slice(0, precision)
              : zeroPad(right, precision));
        } else {
          right = "";
        }

        var stringIndex = numberString.length - 1,
          sep = formatInfo[","],
          ret = "";

        while (stringIndex >= 0) {
          if (curSize === 0 || curSize > stringIndex) {
            return (
              numberString.slice(0, stringIndex + 1) +
              (ret.length ? sep + ret + right : right)
            );
          }
          ret =
            numberString.slice(stringIndex - curSize + 1, stringIndex + 1) +
            (ret.length ? sep + ret : "");

          stringIndex -= curSize;

          if (curGroupIndex < groupSizes.length) {
            curSize = groupSizes[curGroupIndex];
            curGroupIndex++;
          }
        }

        return numberString.slice(0, stringIndex + 1) + sep + ret + right;
      };

      formatNumber = function (value, format, culture) {
        if (!isFinite(value)) {
          if (value === Infinity) {
            return culture.numberFormat.positiveInfinity;
          }
          if (value === -Infinity) {
            return culture.numberFormat.negativeInfinity;
          }
          return culture.numberFormat.NaN;
        }
        if (!format || format === "i") {
          return culture.name.length
            ? value.toLocaleString()
            : value.toString();
        }
        format = format || "D";

        var nf = culture.numberFormat,
          number = Math.abs(value),
          precision = -1,
          pattern;
        if (format.length > 1) precision = parseInt(format.slice(1), 10);

        var current = format.charAt(0).toUpperCase(),
          formatInfo;

        switch (current) {
          case "D":
            pattern = "n";
            number = truncate(number);
            if (precision !== -1) {
              number = zeroPad("" + number, precision, true);
            }
            if (value < 0) number = "-" + number;
            break;
          case "N":
            formatInfo = nf;
          /* falls through */
          case "C":
            formatInfo = formatInfo || nf.currency;
          /* falls through */
          case "P":
            formatInfo = formatInfo || nf.percent;
            pattern =
              value < 0 ? formatInfo.pattern[0] : formatInfo.pattern[1] || "n";
            if (precision === -1) precision = formatInfo.decimals;
            number = expandNumber(
              number * (current === "P" ? 100 : 1),
              precision,
              formatInfo
            );
            break;
          default:
            throw "Bad number format specifier: " + current;
        }

        var patternParts = /n|\$|-|%/g,
          ret = "";
        for (;;) {
          var index = patternParts.lastIndex,
            ar = patternParts.exec(pattern);

          ret += pattern.slice(index, ar ? ar.index : pattern.length);

          if (!ar) {
            break;
          }

          switch (ar[0]) {
            case "n":
              ret += number;
              break;
            case "$":
              ret += nf.currency.symbol;
              break;
            case "-":
              // don't make 0 negative
              if (/[1-9]/.test(number)) {
                ret += nf["-"];
              }
              break;
            case "%":
              ret += nf.percent.symbol;
              break;
          }
        }

        return ret;
      };
    })();

    getTokenRegExp = function () {
      // regular expression for matching date and time tokens in format strings.
      return /\/|dddd|ddd|dd|d|MMMM|MMM|MM|M|yyyy|yy|y|hh|h|HH|H|mm|m|ss|s|tt|t|fff|ff|f|zzz|zz|z|gg|g/g;
    };

    getEra = function (date, eras) {
      if (!eras) return 0;
      var start,
        ticks = date.getTime();
      for (var i = 0, l = eras.length; i < l; i++) {
        start = eras[i].start;
        if (start === null || ticks >= start) {
          return i;
        }
      }
      return 0;
    };

    getEraYear = function (date, cal, era, sortable) {
      var year = date.getFullYear();
      if (!sortable && cal.eras) {
        // convert normal gregorian year to era-shifted gregorian
        // year by subtracting the era offset
        year -= cal.eras[era].offset;
      }
      return year;
    };

    // parseExact
    (function () {
      var expandYear,
        getDayIndex,
        getMonthIndex,
        getParseRegExp,
        outOfRange,
        toUpper,
        toUpperArray;

      expandYear = function (cal, year) {
        // expands 2-digit year into 4 digits.
        if (year < 100) {
          var now = new Date(),
            era = getEra(now),
            curr = getEraYear(now, cal, era),
            twoDigitYearMax = cal.twoDigitYearMax;
          twoDigitYearMax =
            typeof twoDigitYearMax === "string"
              ? (new Date().getFullYear() % 100) + parseInt(twoDigitYearMax, 10)
              : twoDigitYearMax;
          year += curr - (curr % 100);
          if (year > twoDigitYearMax) {
            year -= 100;
          }
        }
        return year;
      };

      getDayIndex = function (cal, value, abbr) {
        var ret,
          days = cal.days,
          upperDays = cal._upperDays;
        if (!upperDays) {
          cal._upperDays = upperDays = [
            toUpperArray(days.names),
            toUpperArray(days.namesAbbr),
            toUpperArray(days.namesShort),
          ];
        }
        value = toUpper(value);
        if (abbr) {
          ret = arrayIndexOf(upperDays[1], value);
          if (ret === -1) {
            ret = arrayIndexOf(upperDays[2], value);
          }
        } else {
          ret = arrayIndexOf(upperDays[0], value);
        }
        return ret;
      };

      getMonthIndex = function (cal, value, abbr) {
        var months = cal.months,
          monthsGen = cal.monthsGenitive || cal.months,
          upperMonths = cal._upperMonths,
          upperMonthsGen = cal._upperMonthsGen;
        if (!upperMonths) {
          cal._upperMonths = upperMonths = [
            toUpperArray(months.names),
            toUpperArray(months.namesAbbr),
          ];
          cal._upperMonthsGen = upperMonthsGen = [
            toUpperArray(monthsGen.names),
            toUpperArray(monthsGen.namesAbbr),
          ];
        }
        value = toUpper(value);
        var i = arrayIndexOf(abbr ? upperMonths[1] : upperMonths[0], value);
        if (i < 0) {
          i = arrayIndexOf(abbr ? upperMonthsGen[1] : upperMonthsGen[0], value);
        }
        return i;
      };

      getParseRegExp = function (cal, format) {
        // converts a format string into a regular expression with groups that
        // can be used to extract date fields from a date string.
        // check for a cached parse regex.
        var re = cal._parseRegExp;
        if (!re) {
          cal._parseRegExp = re = {};
        } else {
          var reFormat = re[format];
          if (reFormat) {
            return reFormat;
          }
        }

        // expand single digit formats, then escape regular expression characters.
        var expFormat = expandFormat(cal, format).replace(
            /([\^\$\.\*\+\?\|\[\]\(\)\{\}])/g,
            "\\\\$1"
          ),
          regexp = ["^"],
          groups = [],
          index = 0,
          quoteCount = 0,
          tokenRegExp = getTokenRegExp(),
          match;

        // iterate through each date token found.
        while ((match = tokenRegExp.exec(expFormat)) !== null) {
          var preMatch = expFormat.slice(index, match.index);
          index = tokenRegExp.lastIndex;

          // don't replace any matches that occur inside a string literal.
          quoteCount += appendPreOrPostMatch(preMatch, regexp);
          if (quoteCount % 2) {
            regexp.push(match[0]);
            continue;
          }

          // add a regex group for the token.
          var m = match[0],
            len = m.length,
            add;
          switch (m) {
            case "dddd":
            case "ddd":
            case "MMMM":
            case "MMM":
            case "gg":
            case "g":
              add = "(\\D+)";
              break;
            case "tt":
            case "t":
              add = "(\\D*)";
              break;
            case "yyyy":
            case "fff":
            case "ff":
            case "f":
              add = "(\\d{" + len + "})";
              break;
            case "dd":
            case "d":
            case "MM":
            case "M":
            case "yy":
            case "y":
            case "HH":
            case "H":
            case "hh":
            case "h":
            case "mm":
            case "m":
            case "ss":
            case "s":
              add = "(\\d\\d?)";
              break;
            case "zzz":
              add = "([+-]?\\d\\d?:\\d{2})";
              break;
            case "zz":
            case "z":
              add = "([+-]?\\d\\d?)";
              break;
            case "/":
              add = "(\\/)";
              break;
            default:
              throw "Invalid date format pattern '" + m + "'.";
          }
          if (add) {
            regexp.push(add);
          }
          groups.push(match[0]);
        }
        appendPreOrPostMatch(expFormat.slice(index), regexp);
        regexp.push("$");

        // allow whitespace to differ when matching formats.
        var regexpStr = regexp.join("").replace(/\s+/g, "\\s+"),
          parseRegExp = { regExp: regexpStr, groups: groups };

        // cache the regex for this format.
        return (re[format] = parseRegExp);
      };

      outOfRange = function (value, low, high) {
        return value < low || value > high;
      };

      toUpper = function (value) {
        // "he-IL" has non-breaking space in weekday names.
        return value.split("\u00A0").join(" ").toUpperCase();
      };

      toUpperArray = function (arr) {
        var results = [];
        for (var i = 0, l = arr.length; i < l; i++) {
          results[i] = toUpper(arr[i]);
        }
        return results;
      };

      parseExact = function (value, format, culture) {
        // try to parse the date string by matching against the format string
        // while using the specified culture for date field names.
        value = trim(value);
        var cal = culture.calendar,
          // convert date formats into regular expressions with groupings.
          // use the regexp to determine the input format and extract the date fields.
          parseInfo = getParseRegExp(cal, format),
          match = new RegExp(parseInfo.regExp).exec(value);
        if (match === null) {
          return null;
        }
        // found a date format that matches the input.
        var groups = parseInfo.groups,
          era = null,
          year = null,
          month = null,
          date = null,
          weekDay = null,
          hour = 0,
          hourOffset,
          min = 0,
          sec = 0,
          msec = 0,
          tzMinOffset = null,
          pmHour = false;
        // iterate the format groups to extract and set the date fields.
        for (var j = 0, jl = groups.length; j < jl; j++) {
          var matchGroup = match[j + 1];
          if (matchGroup) {
            var current = groups[j],
              clength = current.length,
              matchInt = parseInt(matchGroup, 10);
            switch (current) {
              case "dd":
              case "d":
                // Day of month.
                date = matchInt;
                // check that date is generally in valid range, also checking overflow below.
                if (outOfRange(date, 1, 31)) return null;
                break;
              case "MMM":
              case "MMMM":
                month = getMonthIndex(cal, matchGroup, clength === 3);
                if (outOfRange(month, 0, 11)) return null;
                break;
              case "M":
              case "MM":
                // Month.
                month = matchInt - 1;
                if (outOfRange(month, 0, 11)) return null;
                break;
              case "y":
              case "yy":
              case "yyyy":
                year = clength < 4 ? expandYear(cal, matchInt) : matchInt;
                if (outOfRange(year, 0, 9999)) return null;
                break;
              case "h":
              case "hh":
                // Hours (12-hour clock).
                hour = matchInt;
                if (hour === 12) hour = 0;
                if (outOfRange(hour, 0, 11)) return null;
                break;
              case "H":
              case "HH":
                // Hours (24-hour clock).
                hour = matchInt;
                if (outOfRange(hour, 0, 23)) return null;
                break;
              case "m":
              case "mm":
                // Minutes.
                min = matchInt;
                if (outOfRange(min, 0, 59)) return null;
                break;
              case "s":
              case "ss":
                // Seconds.
                sec = matchInt;
                if (outOfRange(sec, 0, 59)) return null;
                break;
              case "tt":
              case "t":
                // AM/PM designator.
                // see if it is standard, upper, or lower case PM. If not, ensure it is at least one of
                // the AM tokens. If not, fail the parse for this format.
                pmHour =
                  cal.PM &&
                  (matchGroup === cal.PM[0] ||
                    matchGroup === cal.PM[1] ||
                    matchGroup === cal.PM[2]);
                if (
                  !pmHour &&
                  (!cal.AM ||
                    (matchGroup !== cal.AM[0] &&
                      matchGroup !== cal.AM[1] &&
                      matchGroup !== cal.AM[2]))
                )
                  return null;
                break;
              case "f":
              // Deciseconds.
              case "ff":
              // Centiseconds.
              case "fff":
                // Milliseconds.
                msec = matchInt * Math.pow(10, 3 - clength);
                if (outOfRange(msec, 0, 999)) return null;
                break;
              case "ddd":
              // Day of week.
              case "dddd":
                // Day of week.
                weekDay = getDayIndex(cal, matchGroup, clength === 3);
                if (outOfRange(weekDay, 0, 6)) return null;
                break;
              case "zzz":
                // Time zone offset in +/- hours:min.
                var offsets = matchGroup.split(/:/);
                if (offsets.length !== 2) return null;
                hourOffset = parseInt(offsets[0], 10);
                if (outOfRange(hourOffset, -12, 13)) return null;
                var minOffset = parseInt(offsets[1], 10);
                if (outOfRange(minOffset, 0, 59)) return null;
                tzMinOffset =
                  hourOffset * 60 +
                  (startsWith(matchGroup, "-") ? -minOffset : minOffset);
                break;
              case "z":
              case "zz":
                // Time zone offset in +/- hours.
                hourOffset = matchInt;
                if (outOfRange(hourOffset, -12, 13)) return null;
                tzMinOffset = hourOffset * 60;
                break;
              case "g":
              case "gg":
                var eraName = matchGroup;
                if (!eraName || !cal.eras) return null;
                eraName = trim(eraName.toLowerCase());
                for (var i = 0, l = cal.eras.length; i < l; i++) {
                  if (eraName === cal.eras[i].name.toLowerCase()) {
                    era = i;
                    break;
                  }
                }
                // could not find an era with that name
                if (era === null) return null;
                break;
            }
          }
        }
        var result = new Date(),
          defaultYear,
          convert = cal.convert;
        defaultYear = convert
          ? convert.fromGregorian(result)[0]
          : result.getFullYear();
        if (year === null) {
          year = defaultYear;
        } else if (cal.eras) {
          // year must be shifted to normal gregorian year
          // but not if year was not specified, its already normal gregorian
          // per the main if clause above.
          year += cal.eras[era || 0].offset;
        }
        // set default day and month to 1 and January, so if unspecified, these are the defaults
        // instead of the current day/month.
        if (month === null) {
          month = 0;
        }
        if (date === null) {
          date = 1;
        }
        // now have year, month, and date, but in the culture's calendar.
        // convert to gregorian if necessary
        if (convert) {
          result = convert.toGregorian(year, month, date);
          // conversion failed, must be an invalid match
          if (result === null) return null;
        } else {
          // have to set year, month and date together to avoid overflow based on current date.
          result.setFullYear(year, month, date);
          // check to see if date overflowed for specified month (only checked 1-31 above).
          if (result.getDate() !== date) return null;
          // invalid day of week.
          if (weekDay !== null && result.getDay() !== weekDay) {
            return null;
          }
        }
        // if pm designator token was found make sure the hours fit the 24-hour clock.
        if (pmHour && hour < 12) {
          hour += 12;
        }
        result.setHours(hour, min, sec, msec);
        if (tzMinOffset !== null) {
          // adjust timezone to utc before applying local offset.
          var adjustedMin =
            result.getMinutes() - (tzMinOffset + result.getTimezoneOffset());
          // Safari limits hours and minutes to the range of -127 to 127.  We need to use setHours
          // to ensure both these fields will not exceed this range.	adjustedMin will range
          // somewhere between -1440 and 1500, so we only need to split this into hours.
          result.setHours(
            result.getHours() + parseInt(adjustedMin / 60, 10),
            adjustedMin % 60
          );
        }
        return result;
      };
    })();

    parseNegativePattern = function (value, nf, negativePattern) {
      var neg = nf["-"],
        pos = nf["+"],
        ret;
      switch (negativePattern) {
        case "n -":
          neg = " " + neg;
          pos = " " + pos;
        /* falls through */
        case "n-":
          if (endsWith(value, neg)) {
            ret = ["-", value.substr(0, value.length - neg.length)];
          } else if (endsWith(value, pos)) {
            ret = ["+", value.substr(0, value.length - pos.length)];
          }
          break;
        case "- n":
          neg += " ";
          pos += " ";
        /* falls through */
        case "-n":
          if (startsWith(value, neg)) {
            ret = ["-", value.substr(neg.length)];
          } else if (startsWith(value, pos)) {
            ret = ["+", value.substr(pos.length)];
          }
          break;
        case "(n)":
          if (startsWith(value, "(") && endsWith(value, ")")) {
            ret = ["-", value.substr(1, value.length - 2)];
          }
          break;
      }
      return ret || ["", value];
    };

    //
    // public instance functions
    //

    Globalize.prototype.findClosestCulture = function (cultureSelector) {
      return Globalize.findClosestCulture.call(this, cultureSelector);
    };

    Globalize.prototype.format = function (value, format, cultureSelector) {
      return Globalize.format.call(this, value, format, cultureSelector);
    };

    Globalize.prototype.localize = function (key, cultureSelector) {
      return Globalize.localize.call(this, key, cultureSelector);
    };

    Globalize.prototype.parseInt = function (value, radix, cultureSelector) {
      return Globalize.parseInt.call(this, value, radix, cultureSelector);
    };

    Globalize.prototype.parseFloat = function (value, radix, cultureSelector) {
      return Globalize.parseFloat.call(this, value, radix, cultureSelector);
    };

    Globalize.prototype.culture = function (cultureSelector) {
      return Globalize.culture.call(this, cultureSelector);
    };

    //
    // public singleton functions
    //

    Globalize.addCultureInfo = function (cultureName, baseCultureName, info) {
      var base = {},
        isNew = false;

      if (typeof cultureName !== "string") {
        // cultureName argument is optional string. If not specified, assume info is first
        // and only argument. Specified info deep-extends current culture.
        info = cultureName;
        cultureName = this.culture().name;
        base = this.cultures[cultureName];
      } else if (typeof baseCultureName !== "string") {
        // baseCultureName argument is optional string. If not specified, assume info is second
        // argument. Specified info deep-extends specified culture.
        // If specified culture does not exist, create by deep-extending default
        info = baseCultureName;
        isNew = this.cultures[cultureName] == null;
        base = this.cultures[cultureName] || this.cultures["default"];
      } else {
        // cultureName and baseCultureName specified. Assume a new culture is being created
        // by deep-extending an specified base culture
        isNew = true;
        base = this.cultures[baseCultureName];
      }

      this.cultures[cultureName] = extend(true, {}, base, info);
      // Make the standard calendar the current culture if it's a new culture
      if (isNew) {
        this.cultures[cultureName].calendar =
          this.cultures[cultureName].calendars.standard;
      }
    };

    Globalize.findClosestCulture = function (name) {
      var match;
      if (!name) {
        return (
          this.findClosestCulture(this.cultureSelector) ||
          this.cultures["default"]
        );
      }
      if (typeof name === "string") {
        name = name.split(",");
      }
      if (isArray(name)) {
        var lang,
          cultures = this.cultures,
          list = name,
          i,
          l = list.length,
          prioritized = [];
        for (i = 0; i < l; i++) {
          name = trim(list[i]);
          var pri,
            parts = name.split(";");
          lang = trim(parts[0]);
          if (parts.length === 1) {
            pri = 1;
          } else {
            name = trim(parts[1]);
            if (name.indexOf("q=") === 0) {
              name = name.substr(2);
              pri = parseFloat(name);
              pri = isNaN(pri) ? 0 : pri;
            } else {
              pri = 1;
            }
          }
          prioritized.push({ lang: lang, pri: pri });
        }
        prioritized.sort(function (a, b) {
          if (a.pri < b.pri) {
            return 1;
          } else if (a.pri > b.pri) {
            return -1;
          }
          return 0;
        });
        // exact match
        for (i = 0; i < l; i++) {
          lang = prioritized[i].lang;
          match = cultures[lang];
          if (match) {
            return match;
          }
        }

        // neutral language match
        for (i = 0; i < l; i++) {
          lang = prioritized[i].lang;
          do {
            var index = lang.lastIndexOf("-");
            if (index === -1) {
              break;
            }
            // strip off the last part. e.g. en-US => en
            lang = lang.substr(0, index);
            match = cultures[lang];
            if (match) {
              return match;
            }
          } while (1);
        }

        // last resort: match first culture using that language
        for (i = 0; i < l; i++) {
          lang = prioritized[i].lang;
          for (var cultureKey in cultures) {
            var culture = cultures[cultureKey];
            if (culture.language === lang) {
              return culture;
            }
          }
        }
      } else if (typeof name === "object") {
        return name;
      }
      return match || null;
    };

    Globalize.format = function (value, format, cultureSelector) {
      var culture = this.findClosestCulture(cultureSelector);
      if (value instanceof Date) {
        value = formatDate(value, format, culture);
      } else if (typeof value === "number") {
        value = formatNumber(value, format, culture);
      }
      return value;
    };

    Globalize.localize = function (key, cultureSelector) {
      return (
        this.findClosestCulture(cultureSelector).messages[key] ||
        this.cultures["default"].messages[key]
      );
    };

    Globalize.parseDate = function (value, formats, culture) {
      culture = this.findClosestCulture(culture);

      var date, prop, patterns;
      if (formats) {
        if (typeof formats === "string") {
          formats = [formats];
        }
        if (formats.length) {
          for (var i = 0, l = formats.length; i < l; i++) {
            var format = formats[i];
            if (format) {
              date = parseExact(value, format, culture);
              if (date) {
                break;
              }
            }
          }
        }
      } else {
        patterns = culture.calendar.patterns;
        for (prop in patterns) {
          date = parseExact(value, patterns[prop], culture);
          if (date) {
            break;
          }
        }
      }

      return date || null;
    };

    Globalize.parseInt = function (value, radix, cultureSelector) {
      return truncate(Globalize.parseFloat(value, radix, cultureSelector));
    };

    Globalize.parseFloat = function (value, radix, cultureSelector) {
      // radix argument is optional
      if (typeof radix !== "number") {
        cultureSelector = radix;
        radix = 10;
      }

      var culture = this.findClosestCulture(cultureSelector);
      var ret = NaN,
        nf = culture.numberFormat;

      if (value.indexOf(culture.numberFormat.currency.symbol) > -1) {
        // remove currency symbol
        value = value.replace(culture.numberFormat.currency.symbol, "");
        // replace decimal seperator
        value = value.replace(
          culture.numberFormat.currency["."],
          culture.numberFormat["."]
        );
      }

      //Remove percentage character from number string before parsing
      if (value.indexOf(culture.numberFormat.percent.symbol) > -1) {
        value = value.replace(culture.numberFormat.percent.symbol, "");
      }

      // remove spaces: leading, trailing and between - and number. Used for negative currency pt-BR
      value = value.replace(/ /g, "");

      // allow infinity or hexidecimal
      if (regexInfinity.test(value)) {
        ret = parseFloat(value);
      } else if (!radix && regexHex.test(value)) {
        ret = parseInt(value, 16);
      } else {
        // determine sign and number
        var signInfo = parseNegativePattern(value, nf, nf.pattern[0]),
          sign = signInfo[0],
          num = signInfo[1];

        // #44 - try parsing as "(n)"
        if (sign === "" && nf.pattern[0] !== "(n)") {
          signInfo = parseNegativePattern(value, nf, "(n)");
          sign = signInfo[0];
          num = signInfo[1];
        }

        // try parsing as "-n"
        if (sign === "" && nf.pattern[0] !== "-n") {
          signInfo = parseNegativePattern(value, nf, "-n");
          sign = signInfo[0];
          num = signInfo[1];
        }

        sign = sign || "+";

        // determine exponent and number
        var exponent,
          intAndFraction,
          exponentPos = num.indexOf("e");
        if (exponentPos < 0) exponentPos = num.indexOf("E");
        if (exponentPos < 0) {
          intAndFraction = num;
          exponent = null;
        } else {
          intAndFraction = num.substr(0, exponentPos);
          exponent = num.substr(exponentPos + 1);
        }
        // determine decimal position
        var integer,
          fraction,
          decSep = nf["."],
          decimalPos = intAndFraction.indexOf(decSep);
        if (decimalPos < 0) {
          integer = intAndFraction;
          fraction = null;
        } else {
          integer = intAndFraction.substr(0, decimalPos);
          fraction = intAndFraction.substr(decimalPos + decSep.length);
        }
        // handle groups (e.g. 1,000,000)
        var groupSep = nf[","];
        integer = integer.split(groupSep).join("");
        var altGroupSep = groupSep.replace(/\u00A0/g, " ");
        if (groupSep !== altGroupSep) {
          integer = integer.split(altGroupSep).join("");
        }
        // build a natively parsable number string
        var p = sign + integer;
        if (fraction !== null) {
          p += "." + fraction;
        }
        if (exponent !== null) {
          // exponent itself may have a number patternd
          var expSignInfo = parseNegativePattern(exponent, nf, "-n");
          p += "e" + (expSignInfo[0] || "+") + expSignInfo[1];
        }
        if (regexParseFloat.test(p)) {
          ret = parseFloat(p);
        }
      }
      return ret;
    };

    Globalize.culture = function (cultureSelector) {
      // setter
      if (typeof cultureSelector !== "undefined") {
        this.cultureSelector = cultureSelector;
      }
      // getter
      return (
        this.findClosestCulture(cultureSelector) || this.cultures["default"]
      );
    };
  })(this);

  /*
   * Globalize Culture en-AU
   *
   * http://github.com/jquery/globalize
   *
   * Copyright Software Freedom Conservancy, Inc.
   * Dual licensed under the MIT or GPL Version 2 licenses.
   * http://jquery.org/license
   *
   * This file was generated by the Globalize Culture Generator
   */
  /*
   * 2014-09-23  JR   Changed Australian short-date format from "d/MM/yyyy" to "dd/MM/yyyy" for consistency with the rest of the product eg datepicker.
   */

  (function (window, undefined) {
    var Globalize;

    if (
      typeof require !== "undefined" &&
      typeof exports !== "undefined" &&
      typeof module !== "undefined"
    ) {
      // Assume CommonJS
      Globalize = require("globalize");
    } else {
      // Global variable
      Globalize = window.Globalize;
    }

    Globalize.addCultureInfo("en-AU", "default", {
      name: "en-AU",
      englishName: "English (Australia)",
      nativeName: "English (Australia)",
      numberFormat: {
        currency: {
          pattern: ["-$n", "$n"],
        },
      },
      calendars: {
        standard: {
          firstDay: 1,
          patterns: {
            d: "dd/MM/yyyy",
            D: "dddd, d MMMM yyyy",
            f: "dddd, d MMMM yyyy h:mm tt",
            F: "dddd, d MMMM yyyy h:mm:ss tt",
            M: "dd MMMM",
            Y: "MMMM yyyy",
          },
        },
      },
    });
  })(this);

  /**
   * OpenFB is a micro-library that lets you integrate your JavaScript application with Facebook.
   * OpenFB works for both BROWSER-BASED apps and CORDOVA/PHONEGAP apps.
   * This library has no dependency: You don't need (and shouldn't use) the Facebook SDK with this library. Whe running in
   * Cordova, you also don't need the Facebook Cordova plugin. There is also no dependency on jQuery.
   * OpenFB allows you to login to Facebook and execute any Facebook Graph API request.
   * @author Christophe Coenraets @ccoenraets
   * @version 0.4
   */

  /**
   * MVENTNOR modified to:
   * - Non-event-based way to detect cordova
   * - Ability to pass OAuth callback URL in the login function
   * - Fix bugs with callbacks to make it suitable for promises
   */
  var openFB = (function () {
    var FB_LOGIN_URL = "https://www.facebook.com/dialog/oauth",
      FB_LOGOUT_URL = "https://www.facebook.com/logout.php",
      // By default we store fbtoken in sessionStorage. This can be overridden in init()
      tokenStore = window.sessionStorage,
      fbAppId,
      context = window.location.pathname.substring(
        0,
        window.location.pathname.indexOf("/", 2)
      ),
      baseURL =
        location.protocol +
        "//" +
        location.hostname +
        (location.port ? ":" + location.port : "") +
        context,
      oauthRedirectURL = baseURL + "/oauthcallback.html",
      logoutRedirectURL = baseURL + "/logoutcallback.html",
      // Because the OAuth login spans multiple processes, we need to keep the login callback function as a variable
      // inside the module instead of keeping it local within the login function.
      loginCallback,
      // Indicates if the app is running inside Cordova
      runningInCordova,
      //console.log(oauthRedirectURL);
      //console.log(logoutRedirectURL);

      // MVENTNOR commented out
      //document.addEventListener("deviceready", function () {
      runningInCordova = !!window.cordova;
    //}, false);

    /**
     * Initialize the OpenFB module. You must use this function and initialize the module with an appId before you can
     * use any other function.
     * @param params - init paramters
     *  appId: The id of the Facebook app,
     *  tokenStore: The store used to save the Facebook token. Optional. If not provided, we use sessionStorage.
     */
    function init(params) {
      if (params.appId) {
        fbAppId = params.appId;
      } else {
        throw "appId parameter not set in init()";
      }

      if (params.tokenStore) {
        tokenStore = params.tokenStore;
      }
    }

    /**
     * Checks if the user has logged in with openFB and currently has a session api token.
     * @param callback the function that receives the loginstatus
     */
    function getLoginStatus(callback) {
      var token = tokenStore["fbtoken"],
        loginStatus = {};
      if (token) {
        loginStatus.status = "connected";
        loginStatus.authResponse = { token: token };
      } else {
        loginStatus.status = "unknown";
      }
      if (callback) callback(loginStatus);
    }

    /**
     * Login to Facebook using OAuth. If running in a Browser, the OAuth workflow happens in a a popup window.
     * If running in Cordova container, it happens using the In-App Browser. Don't forget to install the In-App Browser
     * plugin in your Cordova project: cordova plugins add org.apache.cordova.inappbrowser.
     *
     * @param callback - Callback function to invoke when the login process succeeds
     * @param options - options.scope: The set of Facebook permissions requested
     *                  options.callbackUrl: The OAuth callback URL
     * @returns {*}
     */
    function login(callback, options) {
      var loginWindow,
        startTime,
        scope = "";

      if (!fbAppId) {
        return callback({
          status: "unknown",
          error: "Facebook App Id not set.",
        });
      }

      // Inappbrowser load start handler: Used when running in Cordova only
      function loginWindow_loadStartHandler(event) {
        var url = event.url;
        if (url.indexOf("access_token=") > 0 || url.indexOf("error=") > 0) {
          // When we get the access token fast, the login window (inappbrowser) is still opening with animation
          // in the Cordova app, and trying to close it while it's animating generates an exception. Wait a little...
          loginWindow.removeEventListener(
            "loadstart",
            loginWindow_loadStartHandler
          );
          loginWindow.removeEventListener("exit", loginWindow_exitHandler);

          var timeout = 600 - (new Date().getTime() - startTime);
          setTimeout(
            function () {
              loginWindow.close();
              loginWindow = null;
            },
            timeout > 0 ? timeout : 0
          );
          oauthCallback(url);
        }
      }

      // Inappbrowser exit handler: Used when running in Cordova only
      function loginWindow_exitHandler() {
        //console.log('exit and remove listeners');
        // Handle the situation where the user closes the login window manually before completing the login process
        callback({
          status: "user_cancelled",
          error_description: "User cancelled login process",
          error_reason: "user_cancelled",
        });
        loginWindow.removeEventListener(
          "loadstart",
          loginWindow_loadStartHandler
        );
        loginWindow.removeEventListener("exit", loginWindow_exitHandler);
        loginWindow = null;
        //console.log('done removing listeners');
      }

      if (options && options.scope) {
        scope = options.scope;
      }

      loginCallback = callback;

      //        logout();

      if (runningInCordova) {
        oauthRedirectURL = logoutRedirectURL =
          "https://www.facebook.com/connect/login_success.html";
      } else if (options && options.callbackUrl) {
        oauthRedirectURL = logoutRedirectURL = options.callbackUrl;
      }

      startTime = new Date().getTime();
      loginWindow = window.open(
        FB_LOGIN_URL +
          "?client_id=" +
          fbAppId +
          "&redirect_uri=" +
          encodeURIComponent(oauthRedirectURL) +
          "&response_type=token&scope=" +
          scope,
        "_blank",
        "location=no"
      );

      // If the app is running in Cordova, listen to URL changes in the InAppBrowser until we get a URL with an access_token or an error
      if (runningInCordova) {
        loginWindow.addEventListener("loadstart", loginWindow_loadStartHandler);
        loginWindow.addEventListener("exit", loginWindow_exitHandler);
      }
      // Note: if the app is running in the browser the loginWindow dialog will call back by invoking the
      // oauthCallback() function. See oauthcallback.html for details.
    }

    /**
     * Called either by oauthcallback.html (when the app is running the browser) or by the loginWindow loadstart event
     * handler defined in the login() function (when the app is running in the Cordova/PhoneGap container).
     * @param url - The oautchRedictURL called by Facebook with the access_token in the querystring at the ned of the
     * OAuth workflow.
     */
    function oauthCallback(url) {
      // Parse the OAuth data received from Facebook
      var queryString, obj;

      if (url.indexOf("access_token=") > 0) {
        queryString = url.substr(url.indexOf("#") + 1);
        obj = parseQueryString(queryString);
        tokenStore["fbtoken"] = obj["access_token"];
        if (loginCallback)
          loginCallback({
            status: "connected",
            authResponse: { token: obj["access_token"] },
          });
      } else if (url.indexOf("error=") > 0) {
        queryString = url.substring(url.indexOf("?") + 1, url.indexOf("#"));
        obj = parseQueryString(queryString);
        if (loginCallback)
          loginCallback({ status: "not_authorized", error: obj.error });
      } else {
        if (loginCallback) loginCallback({ status: "not_authorized" });
      }

      loginCallback = null;
    }

    /**
     * Logout from Facebook, and remove the token.
     * IMPORTANT: For the Facebook logout to work, the logoutRedirectURL must be on the domain specified in "Site URL" in your Facebook App Settings
     *
     */
    function logout(callback) {
      var logoutWindow,
        token = tokenStore["fbtoken"];

      /* Remove token. Will fail silently if does not exist */
      tokenStore.removeItem("fbtoken");

      if (token) {
        logoutWindow = window.open(
          FB_LOGOUT_URL +
            "?access_token=" +
            token +
            "&next=" +
            encodeURIComponent(logoutRedirectURL),
          "_blank",
          "location=no"
        );
        if (runningInCordova) {
          setTimeout(function () {
            logoutWindow.close();
          }, 700);
        }
      }

      if (callback) {
        callback();
      }
    }

    /**
     * Lets you make any Facebook Graph API request.
     * @param obj - Request configuration object. Can include:
     *  method:  HTTP method: GET, POST, etc. Optional - Default is 'GET'
     *  path:    path in the Facebook graph: /me, /me.friends, etc. - Required
     *  params:  queryString parameters as a map - Optional
     *  success: callback function when operation succeeds - Optional
     *  error:   callback function when operation fails - Optional
     */
    function api(obj) {
      var method = obj.method || "GET",
        params = obj.params || {},
        xhr = new XMLHttpRequest(),
        url;

      params["access_token"] = tokenStore["fbtoken"];

      url =
        "https://graph.facebook.com" + obj.path + "?" + toQueryString(params);

      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
          if (xhr.status === 200) {
            if (obj.success) obj.success(JSON.parse(xhr.responseText));
          } else {
            var error = xhr.responseText
              ? JSON.parse(xhr.responseText).error
              : { message: "An error has occurred" };
            if (obj.error) obj.error(error);
          }
        }
      };

      xhr.open(method, url, true);
      xhr.send();
    }

    /**
     * Helper function to de-authorize the app
     * @param success
     * @param error
     * @returns {*}
     */
    function revokePermissions(success, error) {
      return api({
        method: "DELETE",
        path: "/me/permissions",
        success: function () {
          tokenStore["fbtoken"] = undefined;
          success();
        },
        error: error,
      });
    }

    function parseQueryString(queryString) {
      var qs = decodeURIComponent(queryString),
        obj = {},
        params = qs.split("&");
      params.forEach(function (param) {
        var splitter = param.split("=");
        obj[splitter[0]] = splitter[1];
      });
      return obj;
    }

    function toQueryString(obj) {
      var parts = [];
      for (var i in obj) {
        if (obj.hasOwnProperty(i)) {
          parts.push(encodeURIComponent(i) + "=" + encodeURIComponent(obj[i]));
        }
      }
      return parts.join("&");
    }

    // The public API
    return {
      init: init,
      login: login,
      logout: logout,
      revokePermissions: revokePermissions,
      api: api,
      oauthCallback: oauthCallback,
      getLoginStatus: getLoginStatus,
    };
  })();
  this.openFB = openFB;
  /* http://keith-wood.name/datepick.html
   Date picker for jQuery v4.1.0.
   Written by Keith Wood (kbwood{at}iinet.com.au) February 2010.
   Dual licensed under the GPL (http://dev.jquery.com/browser/trunk/jquery/GPL-LICENSE.txt) and 
   MIT (http://dev.jquery.com/browser/trunk/jquery/MIT-LICENSE.txt) licenses. 
   Please attribute the author if you use it. */
  (function ($) {
    function Datepicker() {
      this._defaults = {
        pickerClass: "",
        showOnFocus: true,
        showTrigger: null,
        showAnim: "show",
        showOptions: {},
        showSpeed: "normal",
        popupContainer: null,
        alignment: "bottom",
        fixedWeeks: false,
        firstDay: 0,
        calculateWeek: this.iso8601Week,
        monthsToShow: 1,
        monthsOffset: 0,
        monthsToStep: 1,
        monthsToJump: 12,
        useMouseWheel: true,
        changeMonth: true,
        yearRange: "c-10:c+10",
        shortYearCutoff: "+10",
        showOtherMonths: false,
        selectOtherMonths: false,
        defaultDate: null,
        selectDefaultDate: false,
        minDate: null,
        maxDate: null,
        dateFormat: "mm/dd/yyyy",
        autoSize: false,
        rangeSelect: false,
        rangeSeparator: " - ",
        multiSelect: 0,
        multiSeparator: ",",
        onDate: null,
        onShow: null,
        onChangeMonthYear: null,
        onSelect: null,
        onClose: null,
        altField: null,
        altFormat: null,
        constrainInput: true,
        commandsAsDateFormat: false,
        commands: this.commands,
      };
      this.regional = [];
      this.regional[""] = {
        monthNames: [
          "January",
          "February",
          "March",
          "April",
          "May",
          "June",
          "July",
          "August",
          "September",
          "October",
          "November",
          "December",
        ],
        monthNamesShort: [
          "Jan",
          "Feb",
          "Mar",
          "Apr",
          "May",
          "Jun",
          "Jul",
          "Aug",
          "Sep",
          "Oct",
          "Nov",
          "Dec",
        ],
        dayNames: [
          "Sunday",
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
        ],
        dayNamesShort: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
        dayNamesMin: ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"],
        dateFormat: "mm/dd/yyyy",
        firstDay: 0,
        renderer: this.defaultRenderer,
        prevText: "&lt;Prev",
        prevStatus: "Show the previous month",
        prevJumpText: "&lt;&lt;",
        prevJumpStatus: "Show the previous year",
        nextText: "Next&gt;",
        nextStatus: "Show the next month",
        nextJumpText: "&gt;&gt;",
        nextJumpStatus: "Show the next year",
        currentText: "Current",
        currentStatus: "Show the current month",
        todayText: "Today",
        todayStatus: "Show today's month",
        clearText: "Clear",
        clearStatus: "Clear all the dates",
        closeText: "Close",
        closeStatus: "Close the datepicker",
        yearStatus: "Change the year",
        monthStatus: "Change the month",
        weekText: "Wk",
        weekStatus: "Week of the year",
        dayStatus: "Select DD, M d, yyyy",
        defaultStatus: "Select a date",
        isRTL: false,
      };
      $.extend(this._defaults, this.regional[""]);
      this._disabled = [];
    }
    $.extend(Datepicker.prototype, {
      markerClassName: "hasDatepick",
      propertyName: "datepick",
      _popupClass: "datepick-popup",
      _triggerClass: "datepick-trigger",
      _disableClass: "datepick-disable",
      _monthYearClass: "datepick-month-year",
      _curMonthClass: "datepick-month-",
      _anyYearClass: "datepick-any-year",
      _curDoWClass: "datepick-dow-",
      commands: {
        prev: {
          text: "prevText",
          status: "prevStatus",
          keystroke: { keyCode: 33 },
          enabled: function (a) {
            var b = a.curMinDate();
            return (
              !b ||
              F.add(
                F.day(
                  F._applyMonthsOffset(
                    F.add(
                      F.newDate(a.drawDate),
                      1 - a.options.monthsToStep,
                      "m"
                    ),
                    a
                  ),
                  1
                ),
                -1,
                "d"
              ).getTime() >= b.getTime()
            );
          },
          date: function (a) {
            return F.day(
              F._applyMonthsOffset(
                F.add(F.newDate(a.drawDate), -a.options.monthsToStep, "m"),
                a
              ),
              1
            );
          },
          action: function (a) {
            F._changeMonthPlugin(this, -a.options.monthsToStep);
          },
        },
        prevJump: {
          text: "prevJumpText",
          status: "prevJumpStatus",
          keystroke: { keyCode: 33, ctrlKey: true },
          enabled: function (a) {
            var b = a.curMinDate();
            return (
              !b ||
              F.add(
                F.day(
                  F._applyMonthsOffset(
                    F.add(
                      F.newDate(a.drawDate),
                      1 - a.options.monthsToJump,
                      "m"
                    ),
                    a
                  ),
                  1
                ),
                -1,
                "d"
              ).getTime() >= b.getTime()
            );
          },
          date: function (a) {
            return F.day(
              F._applyMonthsOffset(
                F.add(F.newDate(a.drawDate), -a.options.monthsToJump, "m"),
                a
              ),
              1
            );
          },
          action: function (a) {
            F._changeMonthPlugin(this, -a.options.monthsToJump);
          },
        },
        next: {
          text: "nextText",
          status: "nextStatus",
          keystroke: { keyCode: 34 },
          enabled: function (a) {
            var b = a.get("maxDate");
            return (
              !b ||
              F.day(
                F._applyMonthsOffset(
                  F.add(F.newDate(a.drawDate), a.options.monthsToStep, "m"),
                  a
                ),
                1
              ).getTime() <= b.getTime()
            );
          },
          date: function (a) {
            return F.day(
              F._applyMonthsOffset(
                F.add(F.newDate(a.drawDate), a.options.monthsToStep, "m"),
                a
              ),
              1
            );
          },
          action: function (a) {
            F._changeMonthPlugin(this, a.options.monthsToStep);
          },
        },
        nextJump: {
          text: "nextJumpText",
          status: "nextJumpStatus",
          keystroke: { keyCode: 34, ctrlKey: true },
          enabled: function (a) {
            var b = a.get("maxDate");
            return (
              !b ||
              F.day(
                F._applyMonthsOffset(
                  F.add(F.newDate(a.drawDate), a.options.monthsToJump, "m"),
                  a
                ),
                1
              ).getTime() <= b.getTime()
            );
          },
          date: function (a) {
            return F.day(
              F._applyMonthsOffset(
                F.add(F.newDate(a.drawDate), a.options.monthsToJump, "m"),
                a
              ),
              1
            );
          },
          action: function (a) {
            F._changeMonthPlugin(this, a.options.monthsToJump);
          },
        },
        current: {
          text: "currentText",
          status: "currentStatus",
          keystroke: { keyCode: 36, ctrlKey: true },
          enabled: function (a) {
            var b = a.curMinDate();
            var c = a.get("maxDate");
            var d = a.selectedDates[0] || F.today();
            return (
              (!b || d.getTime() >= b.getTime()) &&
              (!c || d.getTime() <= c.getTime())
            );
          },
          date: function (a) {
            return a.selectedDates[0] || F.today();
          },
          action: function (a) {
            var b = a.selectedDates[0] || F.today();
            F._showMonthPlugin(this, b.getFullYear(), b.getMonth() + 1);
          },
        },
        today: {
          text: "todayText",
          status: "todayStatus",
          keystroke: { keyCode: 36, ctrlKey: true },
          enabled: function (a) {
            var b = a.curMinDate();
            var c = a.get("maxDate");
            return (
              (!b || F.today().getTime() >= b.getTime()) &&
              (!c || F.today().getTime() <= c.getTime())
            );
          },
          date: function (a) {
            return F.today();
          },
          action: function (a) {
            F._showMonthPlugin(this);
          },
        },
        clear: {
          text: "clearText",
          status: "clearStatus",
          keystroke: { keyCode: 35, ctrlKey: true },
          enabled: function (a) {
            return true;
          },
          date: function (a) {
            return null;
          },
          action: function (a) {
            F._clearPlugin(this);
          },
        },
        close: {
          text: "closeText",
          status: "closeStatus",
          keystroke: { keyCode: 27 },
          enabled: function (a) {
            return true;
          },
          date: function (a) {
            return null;
          },
          action: function (a) {
            F._hidePlugin(this);
          },
        },
        prevWeek: {
          text: "prevWeekText",
          status: "prevWeekStatus",
          keystroke: { keyCode: 38, ctrlKey: true },
          enabled: function (a) {
            var b = a.curMinDate();
            return (
              !b ||
              F.add(F.newDate(a.drawDate), -7, "d").getTime() >= b.getTime()
            );
          },
          date: function (a) {
            return F.add(F.newDate(a.drawDate), -7, "d");
          },
          action: function (a) {
            F._changeDayPlugin(this, -7);
          },
        },
        prevDay: {
          text: "prevDayText",
          status: "prevDayStatus",
          keystroke: { keyCode: 37, ctrlKey: true },
          enabled: function (a) {
            var b = a.curMinDate();
            return (
              !b ||
              F.add(F.newDate(a.drawDate), -1, "d").getTime() >= b.getTime()
            );
          },
          date: function (a) {
            return F.add(F.newDate(a.drawDate), -1, "d");
          },
          action: function (a) {
            F._changeDayPlugin(this, -1);
          },
        },
        nextDay: {
          text: "nextDayText",
          status: "nextDayStatus",
          keystroke: { keyCode: 39, ctrlKey: true },
          enabled: function (a) {
            var b = a.get("maxDate");
            return (
              !b ||
              F.add(F.newDate(a.drawDate), 1, "d").getTime() <= b.getTime()
            );
          },
          date: function (a) {
            return F.add(F.newDate(a.drawDate), 1, "d");
          },
          action: function (a) {
            F._changeDayPlugin(this, 1);
          },
        },
        nextWeek: {
          text: "nextWeekText",
          status: "nextWeekStatus",
          keystroke: { keyCode: 40, ctrlKey: true },
          enabled: function (a) {
            var b = a.get("maxDate");
            return (
              !b ||
              F.add(F.newDate(a.drawDate), 7, "d").getTime() <= b.getTime()
            );
          },
          date: function (a) {
            return F.add(F.newDate(a.drawDate), 7, "d");
          },
          action: function (a) {
            F._changeDayPlugin(this, 7);
          },
        },
      },
      defaultRenderer: {
        picker:
          '<div class="datepick">' +
          '<div class="datepick-nav">{link:prev}{link:today}{link:next}</div>{months}' +
          '{popup:start}<div class="datepick-ctrl">{link:clear}{link:close}</div>{popup:end}' +
          '<div class="datepick-clear-fix"></div></div>',
        monthRow: '<div class="datepick-month-row">{months}</div>',
        month:
          '<div class="datepick-month"><div class="datepick-month-header">{monthHeader}</div>' +
          "<table><thead>{weekHeader}</thead><tbody>{weeks}</tbody></table></div>",
        weekHeader: "<tr>{days}</tr>",
        dayHeader: "<th>{day}</th>",
        week: "<tr>{days}</tr>",
        day: "<td>{day}</td>",
        monthSelector: ".datepick-month",
        daySelector: "td",
        rtlClass: "datepick-rtl",
        multiClass: "datepick-multi",
        defaultClass: "",
        selectedClass: "datepick-selected",
        highlightedClass: "datepick-highlight",
        todayClass: "datepick-today",
        otherMonthClass: "datepick-other-month",
        weekendClass: "datepick-weekend",
        commandClass: "datepick-cmd",
        commandButtonClass: "",
        commandLinkClass: "",
        disabledClass: "datepick-disabled",
      },
      setDefaults: function (a) {
        $.extend(this._defaults, a || {});
        return this;
      },
      _ticksTo1970:
        ((1970 - 1) * 365 +
          Math.floor(1970 / 4) -
          Math.floor(1970 / 100) +
          Math.floor(1970 / 400)) *
        24 *
        60 *
        60 *
        10000000,
      _msPerDay: 24 * 60 * 60 * 1000,
      ATOM: "yyyy-mm-dd",
      COOKIE: "D, dd M yyyy",
      FULL: "DD, MM d, yyyy",
      ISO_8601: "yyyy-mm-dd",
      JULIAN: "J",
      RFC_822: "D, d M yy",
      RFC_850: "DD, dd-M-yy",
      RFC_1036: "D, d M yy",
      RFC_1123: "D, d M yyyy",
      RFC_2822: "D, d M yyyy",
      RSS: "D, d M yy",
      TICKS: "!",
      TIMESTAMP: "@",
      W3C: "yyyy-mm-dd",
      formatDate: function (f, g, h) {
        if (typeof f != "string") {
          h = g;
          g = f;
          f = "";
        }
        if (!g) {
          return "";
        }
        f = f || this._defaults.dateFormat;
        h = h || {};
        var i = h.dayNamesShort || this._defaults.dayNamesShort;
        var j = h.dayNames || this._defaults.dayNames;
        var k = h.monthNamesShort || this._defaults.monthNamesShort;
        var l = h.monthNames || this._defaults.monthNames;
        var m = h.calculateWeek || this._defaults.calculateWeek;
        var n = function (a, b) {
          var c = 1;
          while (s + c < f.length && f.charAt(s + c) == a) {
            c++;
          }
          s += c - 1;
          return Math.floor(c / (b || 1)) > 1;
        };
        var o = function (a, b, c, d) {
          var e = "" + b;
          if (n(a, d)) {
            while (e.length < c) {
              e = "0" + e;
            }
          }
          return e;
        };
        var p = function (a, b, c, d) {
          return n(a) ? d[b] : c[b];
        };
        var q = "";
        var r = false;
        for (var s = 0; s < f.length; s++) {
          if (r) {
            if (f.charAt(s) == "'" && !n("'")) {
              r = false;
            } else {
              q += f.charAt(s);
            }
          } else {
            switch (f.charAt(s)) {
              case "d":
                q += o("d", g.getDate(), 2);
                break;
              case "D":
                q += p("D", g.getDay(), i, j);
                break;
              case "o":
                q += o("o", this.dayOfYear(g), 3);
                break;
              case "w":
                q += o("w", m(g), 2);
                break;
              case "m":
                q += o("m", g.getMonth() + 1, 2);
                break;
              case "M":
                q += p("M", g.getMonth(), k, l);
                break;
              case "y":
                q += n("y", 2)
                  ? g.getFullYear()
                  : (g.getFullYear() % 100 < 10 ? "0" : "") +
                    (g.getFullYear() % 100);
                break;
              case "@":
                q += Math.floor(g.getTime() / 1000);
                break;
              case "!":
                q += g.getTime() * 10000 + this._ticksTo1970;
                break;
              case "'":
                if (n("'")) {
                  q += "'";
                } else {
                  r = true;
                }
                break;
              default:
                q += f.charAt(s);
            }
          }
        }
        return q;
      },
      parseDate: function (g, h, j) {
        if (h == null) {
          throw "Invalid arguments";
        }
        h = typeof h == "object" ? h.toString() : h + "";
        if (h == "") {
          return null;
        }
        g = g || this._defaults.dateFormat;
        j = j || {};
        var k = j.shortYearCutoff || this._defaults.shortYearCutoff;
        k =
          typeof k != "string"
            ? k
            : (this.today().getFullYear() % 100) + parseInt(k, 10);
        var l = j.dayNamesShort || this._defaults.dayNamesShort;
        var m = j.dayNames || this._defaults.dayNames;
        var n = j.monthNamesShort || this._defaults.monthNamesShort;
        var o = j.monthNames || this._defaults.monthNames;
        var p = -1;
        var q = -1;
        var r = -1;
        var s = -1;
        var t = false;
        var u = false;
        var v = function (a, b) {
          var c = 1;
          while (A + c < g.length && g.charAt(A + c) == a) {
            c++;
          }
          A += c - 1;
          return Math.floor(c / (b || 1)) > 1;
        };
        var w = function (a, b) {
          var c = v(a, b);
          var d = [2, 3, c ? 4 : 2, 11, 20]["oy@!".indexOf(a) + 1];
          var e = new RegExp("^-?\\d{1," + d + "}");
          var f = h.substring(z).match(e);
          if (!f) {
            throw "Missing number at position {0}".replace(/\{0\}/, z);
          }
          z += f[0].length;
          return parseInt(f[0], 10);
        };
        var x = function (a, b, c, d) {
          var e = v(a, d) ? c : b;
          for (var i = 0; i < e.length; i++) {
            if (h.substr(z, e[i].length).toLowerCase() == e[i].toLowerCase()) {
              z += e[i].length;
              return i + 1;
            }
          }
          throw "Unknown name at position {0}".replace(/\{0\}/, z);
        };
        var y = function () {
          if (h.charAt(z) != g.charAt(A)) {
            throw "Unexpected literal at position {0}".replace(/\{0\}/, z);
          }
          z++;
        };
        var z = 0;
        for (var A = 0; A < g.length; A++) {
          if (u) {
            if (g.charAt(A) == "'" && !v("'")) {
              u = false;
            } else {
              y();
            }
          } else {
            switch (g.charAt(A)) {
              case "d":
                r = w("d");
                break;
              case "D":
                x("D", l, m);
                break;
              case "o":
                s = w("o");
                break;
              case "w":
                w("w");
                break;
              case "m":
                q = w("m");
                break;
              case "M":
                q = x("M", n, o);
                break;
              case "y":
                var B = A;
                t = !v("y", 2);
                A = B;
                p = w("y", 2);
                break;
              case "@":
                var C = this._normaliseDate(new Date(w("@") * 1000));
                p = C.getFullYear();
                q = C.getMonth() + 1;
                r = C.getDate();
                break;
              case "!":
                var C = this._normaliseDate(
                  new Date((w("!") - this._ticksTo1970) / 10000)
                );
                p = C.getFullYear();
                q = C.getMonth() + 1;
                r = C.getDate();
                break;
              case "*":
                z = h.length;
                break;
              case "'":
                if (v("'")) {
                  y();
                } else {
                  u = true;
                }
                break;
              default:
                y();
            }
          }
        }
        if (z < h.length) {
          throw "Additional text found at end";
        }
        if (p == -1) {
          p = this.today().getFullYear();
        } else if (p < 100 && t) {
          p +=
            k == -1
              ? 1900
              : this.today().getFullYear() -
                (this.today().getFullYear() % 100) -
                (p <= k ? 0 : 100);
        }
        if (s > -1) {
          q = 1;
          r = s;
          for (
            var D = this.daysInMonth(p, q);
            r > D;
            D = this.daysInMonth(p, q)
          ) {
            q++;
            r -= D;
          }
        }
        var C = this.newDate(p, q, r);
        if (C.getFullYear() != p || C.getMonth() + 1 != q || C.getDate() != r) {
          throw "Invalid date";
        }
        return C;
      },
      determineDate: function (f, g, h, i, j) {
        if (h && typeof h != "object") {
          j = i;
          i = h;
          h = null;
        }
        if (typeof i != "string") {
          j = i;
          i = "";
        }
        var k = function (a) {
          try {
            return F.parseDate(i, a, j);
          } catch (e) {}
          a = a.toLowerCase();
          var b = (a.match(/^c/) && h ? F.newDate(h) : null) || F.today();
          var c = /([+-]?[0-9]+)\s*(d|w|m|y)?/g;
          var d = null;
          while ((d = c.exec(a))) {
            b = F.add(b, parseInt(d[1], 10), d[2] || "d");
          }
          return b;
        };
        g = g ? F.newDate(g) : null;
        f =
          f == null
            ? g
            : typeof f == "string"
            ? k(f)
            : typeof f == "number"
            ? isNaN(f) || f == Infinity || f == -Infinity
              ? g
              : F.add(F.today(), f, "d")
            : F.newDate(f);
        return f;
      },
      daysInMonth: function (a, b) {
        b = a.getFullYear ? a.getMonth() + 1 : b;
        a = a.getFullYear ? a.getFullYear() : a;
        return this.newDate(a, b + 1, 0).getDate();
      },
      dayOfYear: function (a, b, c) {
        var d = a.getFullYear ? a : this.newDate(a, b, c);
        var e = this.newDate(d.getFullYear(), 1, 1);
        return Math.floor((d.getTime() - e.getTime()) / this._msPerDay) + 1;
      },
      iso8601Week: function (a, b, c) {
        var d = a.getFullYear ? new Date(a.getTime()) : this.newDate(a, b, c);
        d.setDate(d.getDate() + 4 - (d.getDay() || 7));
        var e = d.getTime();
        d.setMonth(0, 1);
        return Math.floor(Math.round((e - d) / 86400000) / 7) + 1;
      },
      today: function () {
        return this._normaliseDate(new Date());
      },
      newDate: function (a, b, c) {
        return !a
          ? null
          : a.getFullYear
          ? this._normaliseDate(new Date(a.getTime()))
          : new Date(a, b - 1, c, 12);
      },
      _normaliseDate: function (a) {
        if (a) {
          a.setHours(12, 0, 0, 0);
        }
        return a;
      },
      year: function (a, b) {
        a.setFullYear(b);
        return this._normaliseDate(a);
      },
      month: function (a, b) {
        a.setMonth(b - 1);
        return this._normaliseDate(a);
      },
      day: function (a, b) {
        a.setDate(b);
        return this._normaliseDate(a);
      },
      add: function (a, b, c) {
        if (c == "d" || c == "w") {
          this._normaliseDate(a);
          a.setDate(a.getDate() + b * (c == "w" ? 7 : 1));
        } else {
          var d = a.getFullYear() + (c == "y" ? b : 0);
          var e = a.getMonth() + (c == "m" ? b : 0);
          a.setTime(
            F.newDate(
              d,
              e + 1,
              Math.min(a.getDate(), this.daysInMonth(d, e + 1))
            ).getTime()
          );
        }
        return a;
      },
      _applyMonthsOffset: function (a, b) {
        var c = b.options.monthsOffset;
        if ($.isFunction(c)) {
          c = c.apply(b.target[0], [a]);
        }
        return F.add(a, -c, "m");
      },
      _attachPlugin: function (b, c) {
        b = $(b);
        if (b.hasClass(this.markerClassName)) {
          return;
        }
        var d = $.fn.metadata ? b.metadata() : {};
        var e = {
          options: $.extend({}, this._defaults, d, c),
          target: b,
          selectedDates: [],
          drawDate: null,
          pickingRange: false,
          inline: $.inArray(b[0].nodeName.toLowerCase(), ["div", "span"]) > -1,
          get: function (a) {
            if ($.inArray(a, ["defaultDate", "minDate", "maxDate"]) > -1) {
              return F.determineDate(
                this.options[a],
                null,
                this.selectedDates[0],
                this.options.dateFormat,
                e.getConfig()
              );
            }
            return this.options[a];
          },
          curMinDate: function () {
            return this.pickingRange
              ? this.selectedDates[0]
              : this.get("minDate");
          },
          getConfig: function () {
            return {
              dayNamesShort: this.options.dayNamesShort,
              dayNames: this.options.dayNames,
              monthNamesShort: this.options.monthNamesShort,
              monthNames: this.options.monthNames,
              calculateWeek: this.options.calculateWeek,
              shortYearCutoff: this.options.shortYearCutoff,
            };
          },
        };
        b.addClass(this.markerClassName).data(this.propertyName, e);
        if (e.inline) {
          e.drawDate = F._checkMinMax(
            F.newDate(e.selectedDates[0] || e.get("defaultDate") || F.today()),
            e
          );
          e.prevDate = F.newDate(e.drawDate);
          this._update(b[0]);
          if ($.fn.mousewheel) {
            b.mousewheel(this._doMouseWheel);
          }
        } else {
          this._attachments(b, e);
          b.bind("keydown." + this.propertyName, this._keyDown)
            .bind("keypress." + this.propertyName, this._keyPress)
            .bind("keyup." + this.propertyName, this._keyUp);
          if (b.attr("disabled")) {
            this._disablePlugin(b[0]);
          }
        }
      },
      _optionPlugin: function (b, c, d) {
        b = $(b);
        var e = b.data(this.propertyName);
        if (!c || (typeof c == "string" && d == null)) {
          var f = c;
          c = (e || {}).options;
          return c && f ? c[f] : c;
        }
        if (!b.hasClass(this.markerClassName)) {
          return;
        }
        c = c || {};
        if (typeof c == "string") {
          var f = c;
          c = {};
          c[f] = d;
        }
        if (c.calendar && c.calendar != e.options.calendar) {
          var g = function (a) {
            return typeof e.options[a] == "object" ? null : e.options[a];
          };
          c = $.extend(
            {
              defaultDate: g("defaultDate"),
              minDate: g("minDate"),
              maxDate: g("maxDate"),
            },
            c
          );
          e.selectedDates = [];
          e.drawDate = null;
        }
        var h = e.selectedDates;
        $.extend(e.options, c);
        this._setDatePlugin(b[0], h, null, false, true);
        e.pickingRange = false;
        e.drawDate = F.newDate(
          this._checkMinMax(
            (e.options.defaultDate ? e.get("defaultDate") : e.drawDate) ||
              e.get("defaultDate") ||
              F.today(),
            e
          )
        );
        if (!e.inline) {
          this._attachments(b, e);
        }
        if (e.inline || e.div) {
          this._update(b[0]);
        }
      },
      _attachments: function (a, b) {
        a.unbind("focus." + this.propertyName);
        if (b.options.showOnFocus) {
          a.bind("focus." + this.propertyName, this._showPlugin);
        }
        if (b.trigger) {
          b.trigger.remove();
        }
        var c = b.options.showTrigger;
        b.trigger = !c
          ? $([])
          : $(c)
              .clone()
              .removeAttr("id")
              .addClass(this._triggerClass)
              [b.options.isRTL ? "insertBefore" : "insertAfter"](a)
              .click(function () {
                if (!F._isDisabledPlugin(a[0])) {
                  F[F.curInst == b ? "_hidePlugin" : "_showPlugin"](a[0]);
                }
              });
        this._autoSize(a, b);
        var d = this._extractDates(b, a.val());
        if (d) {
          this._setDatePlugin(a[0], d, null, true);
        }
        var e = b.get("defaultDate");
        if (b.options.selectDefaultDate && e && b.selectedDates.length == 0) {
          this._setDatePlugin(a[0], F.newDate(e || F.today()));
        }
      },
      _autoSize: function (d, e) {
        if (e.options.autoSize && !e.inline) {
          var f = F.newDate(2009, 10, 20);
          var g = e.options.dateFormat;
          if (g.match(/[DM]/)) {
            var h = function (a) {
              var b = 0;
              var c = 0;
              for (var i = 0; i < a.length; i++) {
                if (a[i].length > b) {
                  b = a[i].length;
                  c = i;
                }
              }
              return c;
            };
            f.setMonth(
              h(e.options[g.match(/MM/) ? "monthNames" : "monthNamesShort"])
            );
            f.setDate(
              h(e.options[g.match(/DD/) ? "dayNames" : "dayNamesShort"]) +
                20 -
                f.getDay()
            );
          }
          e.target.attr("size", F.formatDate(g, f, e.getConfig()).length);
        }
      },
      _destroyPlugin: function (a) {
        a = $(a);
        if (!a.hasClass(this.markerClassName)) {
          return;
        }
        var b = a.data(this.propertyName);
        if (b.trigger) {
          b.trigger.remove();
        }
        a.removeClass(this.markerClassName)
          .removeData(this.propertyName)
          .empty()
          .unbind("." + this.propertyName);
        if (b.inline && $.fn.mousewheel) {
          a.unmousewheel();
        }
        if (!b.inline && b.options.autoSize) {
          a.removeAttr("size");
        }
      },
      multipleEvents: function (b) {
        var c = arguments;
        return function (a) {
          for (var i = 0; i < c.length; i++) {
            c[i].apply(this, arguments);
          }
        };
      },
      _enablePlugin: function (b) {
        b = $(b);
        if (!b.hasClass(this.markerClassName)) {
          return;
        }
        var c = b.data(this.propertyName);
        if (c.inline) {
          b.children("." + this._disableClass)
            .remove()
            .end()
            .find("button,select")
            .removeAttr("disabled")
            .end()
            .find("a")
            .attr("href", "javascript:void(0)");
        } else {
          b.prop("disabled", false);
          c.trigger
            .filter("button." + this._triggerClass)
            .removeAttr("disabled")
            .end()
            .filter("img." + this._triggerClass)
            .css({ opacity: "1.0", cursor: "" });
        }
        this._disabled = $.map(this._disabled, function (a) {
          return a == b[0] ? null : a;
        });
      },
      _disablePlugin: function (b) {
        b = $(b);
        if (!b.hasClass(this.markerClassName)) {
          return;
        }
        var c = b.data(this.propertyName);
        if (c.inline) {
          var d = b.children(":last");
          var e = d.offset();
          var f = { left: 0, top: 0 };
          d.parents().each(function () {
            if ($(this).css("position") == "relative") {
              f = $(this).offset();
              return false;
            }
          });
          var g = b.css("zIndex");
          g = (g == "auto" ? 0 : parseInt(g, 10)) + 1;
          b.prepend(
            '<div class="' +
              this._disableClass +
              '" style="' +
              "width: " +
              d.outerWidth() +
              "px; height: " +
              d.outerHeight() +
              "px; left: " +
              (e.left - f.left) +
              "px; top: " +
              (e.top - f.top) +
              "px; z-index: " +
              g +
              '"></div>'
          )
            .find("button,select")
            .attr("disabled", "disabled")
            .end()
            .find("a")
            .removeAttr("href");
        } else {
          b.prop("disabled", true);
          c.trigger
            .filter("button." + this._triggerClass)
            .attr("disabled", "disabled")
            .end()
            .filter("img." + this._triggerClass)
            .css({ opacity: "0.5", cursor: "default" });
        }
        this._disabled = $.map(this._disabled, function (a) {
          return a == b[0] ? null : a;
        });
        this._disabled.push(b[0]);
      },
      _isDisabledPlugin: function (a) {
        return a && $.inArray(a, this._disabled) > -1;
      },
      _showPlugin: function (a) {
        a = $(a.target || a);
        var b = a.data(F.propertyName);
        if (F.curInst == b) {
          return;
        }
        if (F.curInst) {
          F._hidePlugin(F.curInst, true);
        }
        if (b) {
          b.lastVal = null;
          b.selectedDates = F._extractDates(b, a.val());
          b.pickingRange = false;
          b.drawDate = F._checkMinMax(
            F.newDate(b.selectedDates[0] || b.get("defaultDate") || F.today()),
            b
          );
          b.prevDate = F.newDate(b.drawDate);
          F.curInst = b;
          F._update(a[0], true);
          var c = F._checkOffset(b);
          b.div.css({ left: c.left, top: c.top });
          var d = b.options.showAnim;
          var e = b.options.showSpeed;
          e = e == "normal" && $.ui && $.ui.version >= "1.8" ? "_default" : e;
          if ($.effects && $.effects[d]) {
            var f = b.div.data();
            for (var g in f) {
              if (g.match(/^ec\.storage\./)) {
                f[g] = b._mainDiv.css(g.replace(/ec\.storage\./, ""));
              }
            }
            b.div.data(f).show(d, b.options.showOptions, e);
          } else {
            b.div[d || "show"](d ? e : "");
          }
        }
      },
      _extractDates: function (a, b) {
        if (b == a.lastVal) {
          return;
        }
        a.lastVal = b;
        b = b.split(
          a.options.multiSelect
            ? a.options.multiSeparator
            : a.options.rangeSelect
            ? a.options.rangeSeparator
            : "\x00"
        );
        var c = [];
        for (var i = 0; i < b.length; i++) {
          try {
            var d = F.parseDate(a.options.dateFormat, b[i], a.getConfig());
            if (d) {
              var f = false;
              for (var j = 0; j < c.length; j++) {
                if (c[j].getTime() == d.getTime()) {
                  f = true;
                  break;
                }
              }
              if (!f) {
                c.push(d);
              }
            }
          } catch (e) {}
        }
        c.splice(
          a.options.multiSelect || (a.options.rangeSelect ? 2 : 1),
          c.length
        );
        if (a.options.rangeSelect && c.length == 1) {
          c[1] = c[0];
        }
        return c;
      },
      _update: function (a, b) {
        a = $(a.target || a);
        var c = a.data(F.propertyName);
        if (c) {
          if (c.inline || F.curInst == c) {
            if (
              $.isFunction(c.options.onChangeMonthYear) &&
              (!c.prevDate ||
                c.prevDate.getFullYear() != c.drawDate.getFullYear() ||
                c.prevDate.getMonth() != c.drawDate.getMonth())
            ) {
              c.options.onChangeMonthYear.apply(a[0], [
                c.drawDate.getFullYear(),
                c.drawDate.getMonth() + 1,
              ]);
            }
          }
          if (c.inline) {
            a.html(this._generateContent(a[0], c));
          } else if (F.curInst == c) {
            if (!c.div) {
              c.div = $("<div></div>")
                .addClass(this._popupClass)
                .css({
                  display: b ? "none" : "static",
                  position: "absolute",
                  left: a.offset().left,
                  top: a.offset().top + a.outerHeight(),
                })
                .appendTo($(c.options.popupContainer || "body"));
              if ($.fn.mousewheel) {
                c.div.mousewheel(this._doMouseWheel);
              }
            }
            c.div.html(this._generateContent(a[0], c));
            a.focus();
          }
        }
      },
      _updateInput: function (a, b) {
        var c = $.data(a, this.propertyName);
        if (c) {
          var d = "";
          var e = "";
          var f = c.options.multiSelect
            ? c.options.multiSeparator
            : c.options.rangeSeparator;
          var g = c.options.altFormat || c.options.dateFormat;
          for (var i = 0; i < c.selectedDates.length; i++) {
            d += b
              ? ""
              : (i > 0 ? f : "") +
                F.formatDate(
                  c.options.dateFormat,
                  c.selectedDates[i],
                  c.getConfig()
                );
            e +=
              (i > 0 ? f : "") +
              F.formatDate(g, c.selectedDates[i], c.getConfig());
          }
          if (!c.inline && !b) {
            $(a).val(d);
          }
          $(c.options.altField).val(e);
          if ($.isFunction(c.options.onSelect) && !b && !c.inSelect) {
            c.inSelect = true;
            c.options.onSelect.apply(a, [c.selectedDates]);
            c.inSelect = false;
          }
        }
      },
      _getBorders: function (b) {
        var c = function (a) {
          return { thin: 1, medium: 3, thick: 5 }[a] || a;
        };
        return [
          parseFloat(c(b.css("border-left-width"))),
          parseFloat(c(b.css("border-top-width"))),
        ];
      },
      _checkOffset: function (a) {
        var b = a.target.is(":hidden") && a.trigger ? a.trigger : a.target;
        var c = b.offset();
        var d = $(window).width();
        var e = $(window).height();
        if (d == 0) {
          return c;
        }
        var f = false;
        $(a.target)
          .parents()
          .each(function () {
            f |= $(this).css("position") == "fixed";
            return !f;
          });
        var g = document.documentElement.scrollLeft || document.body.scrollLeft;
        var h = document.documentElement.scrollTop || document.body.scrollTop;
        var i = c.top - (f ? h : 0) - a.div.outerHeight();
        var j = c.top - (f ? h : 0) + b.outerHeight();
        var k = c.left - (f ? g : 0);
        var l = c.left - (f ? g : 0) + b.outerWidth() - a.div.outerWidth();
        var m = c.left - g + a.div.outerWidth() > d;
        var n = c.top - h + a.target.outerHeight() + a.div.outerHeight() > e;
        a.div.css("position", f ? "fixed" : "absolute");
        var o = a.options.alignment;
        if (o == "topLeft") {
          c = { left: k, top: i };
        } else if (o == "topRight") {
          c = { left: l, top: i };
        } else if (o == "bottomLeft") {
          c = { left: k, top: j };
        } else if (o == "bottomRight") {
          c = { left: l, top: j };
        } else if (o == "top") {
          c = { left: a.options.isRTL || m ? l : k, top: i };
        } else {
          c = { left: a.options.isRTL || m ? l : k, top: n ? i : j };
        }
        c.left = Math.max(f ? 0 : g, c.left);
        c.top = Math.max(f ? 0 : h, c.top);
        return c;
      },
      _checkExternalClick: function (a) {
        if (!F.curInst) {
          return;
        }
        var b = $(a.target);
        if (
          !b.parents().andSelf().hasClass(F._popupClass) &&
          !b.hasClass(F.markerClassName) &&
          !b.parents().andSelf().hasClass(F._triggerClass)
        ) {
          F._hidePlugin(F.curInst);
        }
      },
      _hidePlugin: function (a, b) {
        if (!a) {
          return;
        }
        var c = $.data(a, this.propertyName) || a;
        if (c && c == F.curInst) {
          var d = b ? "" : c.options.showAnim;
          var e = c.options.showSpeed;
          e = e == "normal" && $.ui && $.ui.version >= "1.8" ? "_default" : e;
          var f = function () {
            if (!c.div) {
              return;
            }
            c.div.remove();
            c.div = null;
            F.curInst = null;
            if ($.isFunction(c.options.onClose)) {
              c.options.onClose.apply(a, [c.selectedDates]);
            }
          };
          c.div.stop();
          if ($.effects && $.effects[d]) {
            c.div.hide(d, c.options.showOptions, e, f);
          } else {
            var g =
              d == "slideDown" ? "slideUp" : d == "fadeIn" ? "fadeOut" : "hide";
            c.div[g](d ? e : "", f);
          }
          if (!d) {
            f();
          }
        }
      },
      _keyDown: function (a) {
        var b = a.target;
        var c = $.data(b, F.propertyName);
        var d = false;
        if (c.div) {
          if (a.keyCode == 9) {
            F._hidePlugin(b);
          } else if (a.keyCode == 13) {
            F._selectDatePlugin(
              b,
              $("a." + c.options.renderer.highlightedClass, c.div)[0]
            );
            d = true;
          } else {
            var e = c.options.commands;
            for (var f in e) {
              var g = e[f];
              if (
                g.keystroke.keyCode == a.keyCode &&
                !!g.keystroke.ctrlKey == !!(a.ctrlKey || a.metaKey) &&
                !!g.keystroke.altKey == a.altKey &&
                !!g.keystroke.shiftKey == a.shiftKey
              ) {
                F._performActionPlugin(b, f);
                d = true;
                break;
              }
            }
          }
        } else {
          var g = c.options.commands.current;
          if (
            g.keystroke.keyCode == a.keyCode &&
            !!g.keystroke.ctrlKey == !!(a.ctrlKey || a.metaKey) &&
            !!g.keystroke.altKey == a.altKey &&
            !!g.keystroke.shiftKey == a.shiftKey
          ) {
            F._showPlugin(b);
            d = true;
          }
        }
        c.ctrlKey =
          (a.keyCode < 48 && a.keyCode != 32) || a.ctrlKey || a.metaKey;
        if (d) {
          a.preventDefault();
          a.stopPropagation();
        }
        return !d;
      },
      _keyPress: function (a) {
        var b = $.data(a.target, F.propertyName);
        if (b && b.options.constrainInput) {
          var c = String.fromCharCode(a.keyCode || a.charCode);
          var d = F._allowedChars(b);
          return a.metaKey || b.ctrlKey || c < " " || !d || d.indexOf(c) > -1;
        }
        return true;
      },
      _allowedChars: function (a) {
        var b = a.options.multiSelect
          ? a.options.multiSeparator
          : a.options.rangeSelect
          ? a.options.rangeSeparator
          : "";
        var c = false;
        var d = false;
        var e = a.options.dateFormat;
        for (var i = 0; i < e.length; i++) {
          var f = e.charAt(i);
          if (c) {
            if (f == "'" && e.charAt(i + 1) != "'") {
              c = false;
            } else {
              b += f;
            }
          } else {
            switch (f) {
              case "d":
              case "m":
              case "o":
              case "w":
                b += d ? "" : "0123456789";
                d = true;
                break;
              case "y":
              case "@":
              case "!":
                b += (d ? "" : "0123456789") + "-";
                d = true;
                break;
              case "J":
                b += (d ? "" : "0123456789") + "-.";
                d = true;
                break;
              case "D":
              case "M":
              case "Y":
                return null;
              case "'":
                if (e.charAt(i + 1) == "'") {
                  b += "'";
                } else {
                  c = true;
                }
                break;
              default:
                b += f;
            }
          }
        }
        return b;
      },
      _keyUp: function (a) {
        var b = a.target;
        var c = $.data(b, F.propertyName);
        if (c && !c.ctrlKey && c.lastVal != c.target.val()) {
          try {
            var d = F._extractDates(c, c.target.val());
            if (d.length > 0) {
              F._setDatePlugin(b, d, null, true);
            }
          } catch (a) {}
        }
        return true;
      },
      _doMouseWheel: function (a, b) {
        var c =
          (F.curInst && F.curInst.target[0]) ||
          $(a.target).closest("." + F.markerClassName)[0];
        if (F._isDisabledPlugin(c)) {
          return;
        }
        var d = $.data(c, F.propertyName);
        if (d.options.useMouseWheel) {
          b = b < 0 ? -1 : +1;
          F._changeMonthPlugin(
            c,
            -d.options[a.ctrlKey ? "monthsToJump" : "monthsToStep"] * b
          );
        }
        a.preventDefault();
      },
      _clearPlugin: function (a) {
        var b = $.data(a, this.propertyName);
        if (b) {
          b.selectedDates = [];
          this._hidePlugin(a);
          var c = b.get("defaultDate");
          if (b.options.selectDefaultDate && c) {
            this._setDatePlugin(a, F.newDate(c || F.today()));
          } else {
            this._updateInput(a);
          }
        }
      },
      _getDatePlugin: function (a) {
        var b = $.data(a, this.propertyName);
        return b ? b.selectedDates : [];
      },
      _setDatePlugin: function (a, b, c, d, e) {
        var f = $.data(a, this.propertyName);
        if (f) {
          if (!$.isArray(b)) {
            b = [b];
            if (c) {
              b.push(c);
            }
          }
          var g = f.get("minDate");
          var h = f.get("maxDate");
          var k = f.selectedDates[0];
          f.selectedDates = [];
          for (var i = 0; i < b.length; i++) {
            var l = F.determineDate(
              b[i],
              null,
              k,
              f.options.dateFormat,
              f.getConfig()
            );
            if (l) {
              if (
                (!g || l.getTime() >= g.getTime()) &&
                (!h || l.getTime() <= h.getTime())
              ) {
                var m = false;
                for (var j = 0; j < f.selectedDates.length; j++) {
                  if (f.selectedDates[j].getTime() == l.getTime()) {
                    m = true;
                    break;
                  }
                }
                if (!m) {
                  f.selectedDates.push(l);
                }
              }
            }
          }
          f.selectedDates.splice(
            f.options.multiSelect || (f.options.rangeSelect ? 2 : 1),
            f.selectedDates.length
          );
          if (f.options.rangeSelect) {
            switch (f.selectedDates.length) {
              case 1:
                f.selectedDates[1] = f.selectedDates[0];
                break;
              case 2:
                f.selectedDates[1] =
                  f.selectedDates[0].getTime() > f.selectedDates[1].getTime()
                    ? f.selectedDates[0]
                    : f.selectedDates[1];
                break;
            }
            f.pickingRange = false;
          }
          f.prevDate = f.drawDate ? F.newDate(f.drawDate) : null;
          f.drawDate = this._checkMinMax(
            F.newDate(f.selectedDates[0] || f.get("defaultDate") || F.today()),
            f
          );
          if (!e) {
            this._update(a);
            this._updateInput(a, d);
          }
        }
      },
      _isSelectablePlugin: function (a, b) {
        var c = $.data(a, this.propertyName);
        if (!c) {
          return false;
        }
        b = F.determineDate(
          b,
          c.selectedDates[0] || this.today(),
          null,
          c.options.dateFormat,
          c.getConfig()
        );
        return this._isSelectable(
          a,
          b,
          c.options.onDate,
          c.get("minDate"),
          c.get("maxDate")
        );
      },
      _isSelectable: function (a, b, c, d, e) {
        var f =
          typeof c == "boolean"
            ? { selectable: c }
            : !$.isFunction(c)
            ? {}
            : c.apply(a, [b, true]);
        return (
          f.selectable != false &&
          (!d || b.getTime() >= d.getTime()) &&
          (!e || b.getTime() <= e.getTime())
        );
      },
      _performActionPlugin: function (a, b) {
        var c = $.data(a, this.propertyName);
        if (c && !this._isDisabledPlugin(a)) {
          var d = c.options.commands;
          if (d[b] && d[b].enabled.apply(a, [c])) {
            d[b].action.apply(a, [c]);
          }
        }
      },
      _showMonthPlugin: function (a, b, c, d) {
        var e = $.data(a, this.propertyName);
        if (
          e &&
          (d != null ||
            e.drawDate.getFullYear() != b ||
            e.drawDate.getMonth() + 1 != c)
        ) {
          e.prevDate = F.newDate(e.drawDate);
          var f = this._checkMinMax(
            b != null ? F.newDate(b, c, 1) : F.today(),
            e
          );
          e.drawDate = F.newDate(
            f.getFullYear(),
            f.getMonth() + 1,
            d != null
              ? d
              : Math.min(
                  e.drawDate.getDate(),
                  F.daysInMonth(f.getFullYear(), f.getMonth() + 1)
                )
          );
          this._update(a);
        }
      },
      _changeMonthPlugin: function (a, b) {
        var c = $.data(a, this.propertyName);
        if (c) {
          var d = F.add(F.newDate(c.drawDate), b, "m");
          this._showMonthPlugin(a, d.getFullYear(), d.getMonth() + 1);
        }
      },
      _changeDayPlugin: function (a, b) {
        var c = $.data(a, this.propertyName);
        if (c) {
          var d = F.add(F.newDate(c.drawDate), b, "d");
          this._showMonthPlugin(
            a,
            d.getFullYear(),
            d.getMonth() + 1,
            d.getDate()
          );
        }
      },
      _checkMinMax: function (a, b) {
        var c = b.get("minDate");
        var d = b.get("maxDate");
        a = c && a.getTime() < c.getTime() ? F.newDate(c) : a;
        a = d && a.getTime() > d.getTime() ? F.newDate(d) : a;
        return a;
      },
      _retrieveDatePlugin: function (a, b) {
        var c = $.data(a, this.propertyName);
        return !c
          ? null
          : this._normaliseDate(
              new Date(
                parseInt(b.className.replace(/^.*dp(-?\d+).*$/, "$1"), 10)
              )
            );
      },
      _selectDatePlugin: function (a, b) {
        var c = $.data(a, this.propertyName);
        if (c && !this._isDisabledPlugin(a)) {
          var d = this._retrieveDatePlugin(a, b);
          if (c.options.multiSelect) {
            var e = false;
            for (var i = 0; i < c.selectedDates.length; i++) {
              if (d.getTime() == c.selectedDates[i].getTime()) {
                c.selectedDates.splice(i, 1);
                e = true;
                break;
              }
            }
            if (!e && c.selectedDates.length < c.options.multiSelect) {
              c.selectedDates.push(d);
            }
          } else if (c.options.rangeSelect) {
            if (c.pickingRange) {
              c.selectedDates[1] = d;
            } else {
              c.selectedDates = [d, d];
            }
            c.pickingRange = !c.pickingRange;
          } else {
            c.selectedDates = [d];
          }
          c.prevDate = F.newDate(d);
          this._updateInput(a);
          if (
            c.inline ||
            c.pickingRange ||
            c.selectedDates.length <
              (c.options.multiSelect || (c.options.rangeSelect ? 2 : 1))
          ) {
            this._update(a);
          } else {
            this._hidePlugin(a);
          }
        }
      },
      _generateContent: function (h, i) {
        var j = i.options.monthsToShow;
        j = $.isArray(j) ? j : [1, j];
        i.drawDate = this._checkMinMax(
          i.drawDate || i.get("defaultDate") || F.today(),
          i
        );
        var k = F._applyMonthsOffset(F.newDate(i.drawDate), i);
        var l = "";
        for (var m = 0; m < j[0]; m++) {
          var n = "";
          for (var o = 0; o < j[1]; o++) {
            n += this._generateMonth(
              h,
              i,
              k.getFullYear(),
              k.getMonth() + 1,
              i.options.renderer,
              m == 0 && o == 0
            );
            F.add(k, 1, "m");
          }
          l += this._prepare(i.options.renderer.monthRow, i).replace(
            /\{months\}/,
            n
          );
        }
        var p = this._prepare(i.options.renderer.picker, i)
          .replace(/\{months\}/, l)
          .replace(
            /\{weekHeader\}/g,
            this._generateDayHeaders(i, i.options.renderer)
          );
        var q = function (a, b, c, d, e) {
          if (p.indexOf("{" + a + ":" + d + "}") == -1) {
            return;
          }
          var f = i.options.commands[d];
          var g = i.options.commandsAsDateFormat ? f.date.apply(h, [i]) : null;
          p = p.replace(
            new RegExp("\\{" + a + ":" + d + "\\}", "g"),
            "<" +
              b +
              (f.status ? ' title="' + i.options[f.status] + '"' : "") +
              ' class="' +
              i.options.renderer.commandClass +
              " " +
              i.options.renderer.commandClass +
              "-" +
              d +
              " " +
              e +
              (f.enabled(i) ? "" : " " + i.options.renderer.disabledClass) +
              '">' +
              (g
                ? F.formatDate(i.options[f.text], g, i.getConfig())
                : i.options[f.text]) +
              "</" +
              c +
              ">"
          );
        };
        for (var r in i.options.commands) {
          q(
            "button",
            'button type="button"',
            "button",
            r,
            i.options.renderer.commandButtonClass
          );
          q(
            "link",
            'a href="javascript:void(0)"',
            "a",
            r,
            i.options.renderer.commandLinkClass
          );
        }
        p = $(p);
        if (j[1] > 1) {
          var s = 0;
          $(i.options.renderer.monthSelector, p).each(function () {
            var a = ++s % j[1];
            $(this).addClass(a == 1 ? "first" : a == 0 ? "last" : "");
          });
        }
        var t = this;
        p.find(i.options.renderer.daySelector + " a")
          .hover(
            function () {
              $(this).addClass(i.options.renderer.highlightedClass);
            },
            function () {
              (i.inline ? $(this).parents("." + t.markerClassName) : i.div)
                .find(i.options.renderer.daySelector + " a")
                .removeClass(i.options.renderer.highlightedClass);
            }
          )
          .click(function () {
            t._selectDatePlugin(h, this);
          })
          .end()
          .find(
            "select." +
              this._monthYearClass +
              ":not(." +
              this._anyYearClass +
              ")"
          )
          .change(function () {
            var a = $(this).val().split("/");
            t._showMonthPlugin(h, parseInt(a[1], 10), parseInt(a[0], 10));
          })
          .end()
          .find("select." + this._anyYearClass)
          .click(function () {
            $(this)
              .css("visibility", "hidden")
              .next("input")
              .css({
                left: this.offsetLeft,
                top: this.offsetTop,
                width: this.offsetWidth,
                height: this.offsetHeight,
              })
              .show()
              .focus();
          })
          .end()
          .find("input." + t._monthYearClass)
          .change(function () {
            try {
              var a = parseInt($(this).val(), 10);
              a = isNaN(a) ? i.drawDate.getFullYear() : a;
              t._showMonthPlugin(
                h,
                a,
                i.drawDate.getMonth() + 1,
                i.drawDate.getDate()
              );
            } catch (e) {
              alert(e);
            }
          })
          .keydown(function (a) {
            if (a.keyCode == 13) {
              $(a.target).change();
            } else if (a.keyCode == 27) {
              $(a.target).hide().prev("select").css("visibility", "visible");
              i.target.focus();
            }
          });
        p.find("." + i.options.renderer.commandClass).click(function () {
          if (!$(this).hasClass(i.options.renderer.disabledClass)) {
            var a = this.className.replace(
              new RegExp(
                "^.*" + i.options.renderer.commandClass + "-([^ ]+).*$"
              ),
              "$1"
            );
            F._performActionPlugin(h, a);
          }
        });
        if (i.options.isRTL) {
          p.addClass(i.options.renderer.rtlClass);
        }
        if (j[0] * j[1] > 1) {
          p.addClass(i.options.renderer.multiClass);
        }
        if (i.options.pickerClass) {
          p.addClass(i.options.pickerClass);
        }
        $("body").append(p);
        var u = 0;
        p.find(i.options.renderer.monthSelector).each(function () {
          u += $(this).outerWidth();
        });
        p.width(u / j[0]);
        if ($.isFunction(i.options.onShow)) {
          i.options.onShow.apply(h, [p, i]);
        }
        return p;
      },
      _generateMonth: function (a, b, c, d, e, f) {
        var g = F.daysInMonth(c, d);
        var h = b.options.monthsToShow;
        h = $.isArray(h) ? h : [1, h];
        var j = b.options.fixedWeeks || h[0] * h[1] > 1;
        var k = b.options.firstDay;
        var l = (F.newDate(c, d, 1).getDay() - k + 7) % 7;
        var m = j ? 6 : Math.ceil((l + g) / 7);
        var n = b.options.selectOtherMonths && b.options.showOtherMonths;
        var o = b.pickingRange ? b.selectedDates[0] : b.get("minDate");
        var p = b.get("maxDate");
        var q = e.week.indexOf("{weekOfYear}") > -1;
        var r = F.today();
        var s = F.newDate(c, d, 1);
        F.add(s, -l - (j && s.getDay() == k ? 7 : 0), "d");
        var t = s.getTime();
        var u = "";
        for (var v = 0; v < m; v++) {
          var w = !q
            ? ""
            : '<span class="dp' +
              t +
              '">' +
              ($.isFunction(b.options.calculateWeek)
                ? b.options.calculateWeek(s)
                : 0) +
              "</span>";
          var x = "";
          for (var y = 0; y < 7; y++) {
            var z = false;
            if (b.options.rangeSelect && b.selectedDates.length > 0) {
              z =
                s.getTime() >= b.selectedDates[0] &&
                s.getTime() <= b.selectedDates[1];
            } else {
              for (var i = 0; i < b.selectedDates.length; i++) {
                if (b.selectedDates[i].getTime() == s.getTime()) {
                  z = true;
                  break;
                }
              }
            }
            var A = !$.isFunction(b.options.onDate)
              ? {}
              : b.options.onDate.apply(a, [s, s.getMonth() + 1 == d]);
            var B =
              (n || s.getMonth() + 1 == d) &&
              this._isSelectable(a, s, A.selectable, o, p);
            x += this._prepare(e.day, b).replace(
              /\{day\}/g,
              (B ? '<a href="javascript:void(0)"' : "<span") +
                ' class="dp' +
                t +
                " " +
                (A.dateClass || "") +
                (z && (n || s.getMonth() + 1 == d)
                  ? " " + e.selectedClass
                  : "") +
                (B ? " " + e.defaultClass : "") +
                ((s.getDay() || 7) < 6 ? "" : " " + e.weekendClass) +
                (s.getMonth() + 1 == d ? "" : " " + e.otherMonthClass) +
                (s.getTime() == r.getTime() && s.getMonth() + 1 == d
                  ? " " + e.todayClass
                  : "") +
                (s.getTime() == b.drawDate.getTime() && s.getMonth() + 1 == d
                  ? " " + e.highlightedClass
                  : "") +
                '"' +
                (A.title || (b.options.dayStatus && B)
                  ? ' title="' +
                    (A.title ||
                      F.formatDate(b.options.dayStatus, s, b.getConfig())) +
                    '"'
                  : "") +
                ">" +
                (b.options.showOtherMonths || s.getMonth() + 1 == d
                  ? A.content || s.getDate()
                  : "&nbsp;") +
                (B ? "</a>" : "</span>")
            );
            F.add(s, 1, "d");
            t = s.getTime();
          }
          u += this._prepare(e.week, b)
            .replace(/\{days\}/g, x)
            .replace(/\{weekOfYear\}/g, w);
        }
        var C = this._prepare(e.month, b).match(/\{monthHeader(:[^\}]+)?\}/);
        C = C[0].length <= 13 ? "MM yyyy" : C[0].substring(13, C[0].length - 1);
        C = f
          ? this._generateMonthSelection(b, c, d, o, p, C, e)
          : F.formatDate(C, F.newDate(c, d, 1), b.getConfig());
        var D = this._prepare(e.weekHeader, b).replace(
          /\{days\}/g,
          this._generateDayHeaders(b, e)
        );
        return this._prepare(e.month, b)
          .replace(/\{monthHeader(:[^\}]+)?\}/g, C)
          .replace(/\{weekHeader\}/g, D)
          .replace(/\{weeks\}/g, u);
      },
      _generateDayHeaders: function (a, b) {
        var c = "";
        for (var d = 0; d < 7; d++) {
          var e = (d + a.options.firstDay) % 7;
          c += this._prepare(b.dayHeader, a).replace(
            /\{day\}/g,
            '<span class="' +
              this._curDoWClass +
              e +
              '" title="' +
              a.options.dayNames[e] +
              '">' +
              a.options.dayNamesMin[e] +
              "</span>"
          );
        }
        return c;
      },
      _generateMonthSelection: function (a, b, c, d, e, f) {
        if (!a.options.changeMonth) {
          return F.formatDate(f, F.newDate(b, c, 1), a.getConfig());
        }
        var g = a.options["monthNames" + (f.match(/mm/i) ? "" : "Short")];
        var h = f.replace(/m+/i, "\\x2E").replace(/y+/i, "\\x2F");
        var i =
          '<select class="' +
          this._monthYearClass +
          '" title="' +
          a.options.monthStatus +
          '">';
        for (var m = 1; m <= 12; m++) {
          if (
            (!d ||
              F.newDate(b, m, F.daysInMonth(b, m)).getTime() >= d.getTime()) &&
            (!e || F.newDate(b, m, 1).getTime() <= e.getTime())
          ) {
            i +=
              '<option value="' +
              m +
              "/" +
              b +
              '"' +
              (c == m ? ' selected="selected"' : "") +
              ">" +
              g[m - 1] +
              "</option>";
          }
        }
        i += "</select>";
        h = h.replace(/\\x2E/, i);
        var j = a.options.yearRange;
        if (j == "any") {
          i =
            '<select class="' +
            this._monthYearClass +
            " " +
            this._anyYearClass +
            '" title="' +
            a.options.yearStatus +
            '">' +
            "<option>" +
            b +
            "</option></select>" +
            '<input class="' +
            this._monthYearClass +
            " " +
            this._curMonthClass +
            c +
            '" value="' +
            b +
            '">';
        } else {
          j = j.split(":");
          var k = F.today().getFullYear();
          var l = j[0].match("c[+-].*")
            ? b + parseInt(j[0].substring(1), 10)
            : (j[0].match("[+-].*") ? k : 0) + parseInt(j[0], 10);
          var n = j[1].match("c[+-].*")
            ? b + parseInt(j[1].substring(1), 10)
            : (j[1].match("[+-].*") ? k : 0) + parseInt(j[1], 10);
          i =
            '<select class="' +
            this._monthYearClass +
            '" title="' +
            a.options.yearStatus +
            '">';
          l = F.add(F.newDate(l + 1, 1, 1), -1, "d");
          n = F.newDate(n, 1, 1);
          var o = function (y) {
            if (y != 0) {
              i +=
                '<option value="' +
                c +
                "/" +
                y +
                '"' +
                (b == y ? ' selected="selected"' : "") +
                ">" +
                y +
                "</option>";
            }
          };
          if (l.getTime() < n.getTime()) {
            l = (d && d.getTime() > l.getTime() ? d : l).getFullYear();
            n = (e && e.getTime() < n.getTime() ? e : n).getFullYear();
            for (var y = l; y <= n; y++) {
              o(y);
            }
          } else {
            l = (e && e.getTime() < l.getTime() ? e : l).getFullYear();
            n = (d && d.getTime() > n.getTime() ? d : n).getFullYear();
            for (var y = l; y >= n; y--) {
              o(y);
            }
          }
          i += "</select>";
        }
        h = h.replace(/\\x2F/, i);
        return h;
      },
      _prepare: function (e, f) {
        var g = function (a, b) {
          while (true) {
            var c = e.indexOf("{" + a + ":start}");
            if (c == -1) {
              return;
            }
            var d = e.substring(c).indexOf("{" + a + ":end}");
            if (d > -1) {
              e =
                e.substring(0, c) +
                (b ? e.substr(c + a.length + 8, d - a.length - 8) : "") +
                e.substring(c + d + a.length + 6);
            }
          }
        };
        g("inline", f.inline);
        g("popup", !f.inline);
        var h = /\{l10n:([^\}]+)\}/;
        var i = null;
        while ((i = h.exec(e))) {
          e = e.replace(i[0], f.options[i[1]]);
        }
        return e;
      },
    });
    var E = ["getDate", "isDisabled", "isSelectable", "retrieveDate"];
    function isNotChained(a, b) {
      if (
        a == "option" &&
        (b.length == 0 || (b.length == 1 && typeof b[0] == "string"))
      ) {
        return true;
      }
      return $.inArray(a, E) > -1;
    }
    $.fn.datepick = function (a) {
      var b = Array.prototype.slice.call(arguments, 1);
      if (isNotChained(a, b)) {
        return F["_" + a + "Plugin"].apply(F, [this[0]].concat(b));
      }
      return this.each(function () {
        if (typeof a == "string") {
          if (!F["_" + a + "Plugin"]) {
            throw "Unknown command: " + a;
          }
          F["_" + a + "Plugin"].apply(F, [this].concat(b));
        } else {
          F._attachPlugin(this, a || {});
        }
      });
    };
    var F = ($.datepick = new Datepicker());
    $(function () {
      $(document)
        .mousedown(F._checkExternalClick)
        .resize(function () {
          F._hidePlugin(F.curInst);
        });
    });
  })(jQuery);
  /* http://keith-wood.name/datepick.html
   English/Australia localisation for jQuery Datepicker.
   Based on en-GB. */
  (function ($) {
    "use strict";
    $.datepick.regional["en-AU"] = {
      monthNames: [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ],
      monthNamesShort: [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ],
      dayNames: [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ],
      dayNamesShort: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
      dayNamesMin: ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"],
      dateFormat: "dd/mm/yyyy",
      firstDay: 1,
      renderer: $.datepick.defaultRenderer,
      prevText: "Prev",
      prevStatus: "Show the previous month",
      prevJumpText: "&#x3c;&#x3c;",
      prevJumpStatus: "Show the previous year",
      nextText: "Next",
      nextStatus: "Show the next month",
      nextJumpText: "&#x3e;&#x3e;",
      nextJumpStatus: "Show the next year",
      currentText: "Current",
      currentStatus: "Show the current month",
      todayText: "Today",
      todayStatus: "Show today's month",
      clearText: "Clear",
      clearStatus: "Erase the current date",
      closeText: "Done",
      closeStatus: "Close without change",
      yearStatus: "Show a different year",
      monthStatus: "Show a different month",
      weekText: "Wk",
      weekStatus: "Week of the year",
      dayStatus: "Select DD, M d",
      defaultStatus: "Select a date",
      isRTL: false,
    };
    $.datepick.setDefaults($.datepick.regional["en-AU"]);
  })(jQuery);

  /**
   * Mega pixel image rendering library for iOS6 Safari
   *
   * Fixes iOS6 Safari's image file rendering issue for large size image (over mega-pixel),
   * which causes unexpected subsampling when drawing it in canvas.
   * By using this library, you can safely render the image with proper stretching.
   *
   * Copyright (c) 2012 Shinichi Tomita <shinichi.tomita@gmail.com>
   * Released under the MIT license
   *
   * Revision 1: Removing AMD loading
   */
  (function (root) {
    /**
     * Detect subsampling in loaded image.
     * In iOS, larger images than 2M pixels may be subsampled in rendering.
     */
    function detectSubsampling(img) {
      var iw = img.naturalWidth,
        ih = img.naturalHeight;
      if (iw * ih > 1024 * 1024) {
        // subsampling may happen over megapixel image
        var canvas = document.createElement("canvas");
        canvas.width = canvas.height = 1;
        var ctx = canvas.getContext("2d");
        ctx.drawImage(img, -iw + 1, 0);
        // subsampled image becomes half smaller in rendering size.
        // check alpha channel value to confirm image is covering edge pixel or not.
        // if alpha value is 0 image is not covering, hence subsampled.
        return ctx.getImageData(0, 0, 1, 1).data[3] === 0;
      } else {
        return false;
      }
    }

    /**
     * Detecting vertical squash in loaded image.
     * Fixes a bug which squash image vertically while drawing into canvas for some images.
     */
    function detectVerticalSquash(img, iw, ih) {
      var canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = ih;
      var ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      var data = ctx.getImageData(0, 0, 1, ih).data;
      // search image edge pixel position in case it is squashed vertically.
      var sy = 0;
      var ey = ih;
      var py = ih;
      while (py > sy) {
        var alpha = data[(py - 1) * 4 + 3];
        if (alpha === 0) {
          ey = py;
        } else {
          sy = py;
        }
        py = (ey + sy) >> 1;
      }
      var ratio = py / ih;
      return ratio === 0 ? 1 : ratio;
    }

    /**
     * Rendering image element (with resizing) and get its data URL
     */
    function renderImageToDataURL(img, options, doSquash) {
      var canvas = document.createElement("canvas");
      renderImageToCanvas(img, canvas, options, doSquash);
      return canvas.toDataURL("image/jpeg", options.quality || 0.8);
    }

    /**
     * Rendering image element (with resizing) into the canvas element
     */
    function renderImageToCanvas(img, canvas, options, doSquash) {
      var iw = img.naturalWidth,
        ih = img.naturalHeight;
      var width = options.width,
        height = options.height;
      var ctx = canvas.getContext("2d");
      ctx.save();
      transformCoordinate(canvas, ctx, width, height, options.orientation);
      var subsampled = detectSubsampling(img);
      if (subsampled) {
        iw /= 2;
        ih /= 2;
      }
      var d = 1024; // size of tiling canvas
      var tmpCanvas = document.createElement("canvas");
      tmpCanvas.width = tmpCanvas.height = d;
      var tmpCtx = tmpCanvas.getContext("2d");
      var vertSquashRatio = doSquash ? detectVerticalSquash(img, iw, ih) : 1;
      var dw = Math.ceil((d * width) / iw);
      var dh = Math.ceil((d * height) / ih / vertSquashRatio);
      var sy = 0;
      var dy = 0;
      while (sy < ih) {
        var sx = 0;
        var dx = 0;
        while (sx < iw) {
          tmpCtx.clearRect(0, 0, d, d);
          tmpCtx.drawImage(img, -sx, -sy);
          ctx.drawImage(tmpCanvas, 0, 0, d, d, dx, dy, dw, dh);
          sx += d;
          dx += dw;
        }
        sy += d;
        dy += dh;
      }
      ctx.restore();
      tmpCanvas = tmpCtx = null;
    }

    /**
     * Transform canvas coordination according to specified frame size and orientation
     * Orientation value is from EXIF tag
     */
    function transformCoordinate(canvas, ctx, width, height, orientation) {
      switch (orientation) {
        case 5:
        case 6:
        case 7:
        case 8:
          canvas.width = height;
          canvas.height = width;
          break;
        default:
          canvas.width = width;
          canvas.height = height;
      }
      switch (orientation) {
        case 2:
          // horizontal flip
          ctx.translate(width, 0);
          ctx.scale(-1, 1);
          break;
        case 3:
          // 180 rotate left
          ctx.translate(width, height);
          ctx.rotate(Math.PI);
          break;
        case 4:
          // vertical flip
          ctx.translate(0, height);
          ctx.scale(1, -1);
          break;
        case 5:
          // vertical flip + 90 rotate right
          ctx.rotate(0.5 * Math.PI);
          ctx.scale(1, -1);
          break;
        case 6:
          // 90 rotate right
          ctx.rotate(0.5 * Math.PI);
          ctx.translate(0, -height);
          break;
        case 7:
          // horizontal flip + 90 rotate right
          ctx.rotate(0.5 * Math.PI);
          ctx.translate(width, -height);
          ctx.scale(-1, 1);
          break;
        case 8:
          // 90 rotate left
          ctx.rotate(-0.5 * Math.PI);
          ctx.translate(-width, 0);
          break;
        default:
          break;
      }
    }

    /**
     * MegaPixImage class
     */
    function MegaPixImage(srcImage) {
      if (window.Blob && srcImage instanceof Blob) {
        var img = new Image();
        var URL =
          window.URL && window.URL.createObjectURL
            ? window.URL
            : window.webkitURL && window.webkitURL.createObjectURL
            ? window.webkitURL
            : null;
        if (!URL) {
          throw Error("No createObjectURL function found to create blob url");
        }
        img.src = URL.createObjectURL(srcImage);
        this.blob = srcImage;
        srcImage = img;
      }
      if (!srcImage.naturalWidth && !srcImage.naturalHeight) {
        var _this = this;
        srcImage.onload = function () {
          var listeners = _this.imageLoadListeners;
          if (listeners) {
            _this.imageLoadListeners = null;
            for (var i = 0, len = listeners.length; i < len; i++) {
              listeners[i]();
            }
          }
        };
        this.imageLoadListeners = [];
      }
      this.srcImage = srcImage;
    }

    /**
     * Rendering megapix image into specified target element
     */
    MegaPixImage.prototype.render = function (target, options) {
      if (this.imageLoadListeners) {
        var _this = this;
        this.imageLoadListeners.push(function () {
          _this.render(target, options);
        });
        return;
      }
      options = options || {};
      var imgWidth = this.srcImage.naturalWidth,
        imgHeight = this.srcImage.naturalHeight,
        width = options.width,
        height = options.height,
        maxWidth = options.maxWidth,
        maxHeight = options.maxHeight,
        doSquash = !this.blob || this.blob.type === "image/jpeg";
      if (width && !height) {
        height = ((imgHeight * width) / imgWidth) << 0;
      } else if (height && !width) {
        width = ((imgWidth * height) / imgHeight) << 0;
      } else {
        width = imgWidth;
        height = imgHeight;
      }
      if (maxWidth && width > maxWidth) {
        width = maxWidth;
        height = ((imgHeight * width) / imgWidth) << 0;
      }
      if (maxHeight && height > maxHeight) {
        height = maxHeight;
        width = ((imgWidth * height) / imgHeight) << 0;
      }
      var opt = { width: width, height: height };
      for (var k in options) opt[k] = options[k];

      var tagName = target.tagName.toLowerCase();
      if (tagName === "img") {
        target.src = renderImageToDataURL(this.srcImage, opt, doSquash);
      } else if (tagName === "canvas") {
        renderImageToCanvas(this.srcImage, target, opt, doSquash);
      }
      if (typeof this.onrender === "function") {
        this.onrender(target);
      }
    };

    /**
     * Export class to global
     */
    /*
     * Revision 1
    if (typeof define === 'function' && define.amd) {
        define([], function() { return MegaPixImage; }); // for AMD loader
    } else {
        this.MegaPixImage = MegaPixImage;
    }
    */
    root.MegaPixImage = MegaPixImage;
  })(this);

  // jQuery Mask Plugin v1.14.0
  // github.com/igorescobar/jQuery-Mask-Plugin
  // Edited to be picked up by webwidgets by removing require header etc.
  // 2016-08-29 JR fixed cleanVal function to not throw an error if masking was not called on a particular element.
  (function ($) {
    var Mask = function (el, mask, options) {
      var p = {
        invalid: [],
        getCaret: function () {
          try {
            var sel,
              pos = 0,
              ctrl = el.get(0),
              dSel = document.selection,
              cSelStart = ctrl.selectionStart;

            // IE Support
            if (dSel && navigator.appVersion.indexOf("MSIE 10") === -1) {
              sel = dSel.createRange();
              sel.moveStart("character", -p.val().length);
              pos = sel.text.length;
            }
            // Firefox support
            else if (cSelStart || cSelStart === "0") {
              pos = cSelStart;
            }

            return pos;
          } catch (e) {}
        },
        setCaret: function (pos) {
          try {
            if (el.is(":focus")) {
              var range,
                ctrl = el.get(0);

              // Firefox, WebKit, etc..
              if (ctrl.setSelectionRange) {
                ctrl.focus();
                ctrl.setSelectionRange(pos, pos);
              } else {
                // IE
                range = ctrl.createTextRange();
                range.collapse(true);
                range.moveEnd("character", pos);
                range.moveStart("character", pos);
                range.select();
              }
            }
          } catch (e) {}
        },
        events: function () {
          el.on("keydown.mask", function (e) {
            el.data("mask-keycode", e.keyCode || e.which);
          })
            .on(
              $.jMaskGlobals.useInput ? "input.mask" : "keyup.mask",
              p.behaviour
            )
            .on("paste.mask drop.mask", function () {
              setTimeout(function () {
                el.keydown().keyup();
              }, 100);
            })
            .on("change.mask", function () {
              el.data("changed", true);
            })
            .on("blur.mask", function () {
              if (oldValue !== p.val() && !el.data("changed")) {
                el.trigger("change");
              }
              el.data("changed", false);
            })
            // it's very important that this callback remains in this position
            // otherwhise oldValue it's going to work buggy
            .on("blur.mask", function () {
              oldValue = p.val();
            })
            // select all text on focus
            .on("focus.mask", function (e) {
              if (options.selectOnFocus === true) {
                $(e.target).select();
              }
            })
            // clear the value if it not complete the mask
            .on("focusout.mask", function () {
              if (options.clearIfNotMatch && !regexMask.test(p.val())) {
                p.val("");
              }
            });
        },
        getRegexMask: function () {
          var maskChunks = [],
            translation,
            pattern,
            optional,
            recursive,
            oRecursive,
            r;

          for (var i = 0; i < mask.length; i++) {
            translation = jMask.translation[mask.charAt(i)];

            if (translation) {
              pattern = translation.pattern
                .toString()
                .replace(/.{1}$|^.{1}/g, "");
              optional = translation.optional;
              recursive = translation.recursive;

              if (recursive) {
                maskChunks.push(mask.charAt(i));
                oRecursive = { digit: mask.charAt(i), pattern: pattern };
              } else {
                maskChunks.push(
                  !optional && !recursive ? pattern : pattern + "?"
                );
              }
            } else {
              maskChunks.push(
                mask.charAt(i).replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&")
              );
            }
          }

          r = maskChunks.join("");

          if (oRecursive) {
            r = r
              .replace(
                new RegExp(
                  "(" + oRecursive.digit + "(.*" + oRecursive.digit + ")?)"
                ),
                "($1)?"
              )
              .replace(new RegExp(oRecursive.digit, "g"), oRecursive.pattern);
          }

          return new RegExp(r);
        },
        destroyEvents: function () {
          el.off(
            [
              "input",
              "keydown",
              "keyup",
              "paste",
              "drop",
              "blur",
              "focusout",
              "",
            ].join(".mask ")
          );
        },
        val: function (v) {
          var isInput = el.is("input"),
            method = isInput ? "val" : "text",
            r;

          if (arguments.length > 0) {
            if (el[method]() !== v) {
              el[method](v);
            }
            r = el;
          } else {
            r = el[method]();
          }

          return r;
        },
        getMCharsBeforeCount: function (index, onCleanVal) {
          for (
            var count = 0, i = 0, maskL = mask.length;
            i < maskL && i < index;
            i++
          ) {
            if (!jMask.translation[mask.charAt(i)]) {
              index = onCleanVal ? index + 1 : index;
              count++;
            }
          }
          return count;
        },
        caretPos: function (originalCaretPos, oldLength, newLength, maskDif) {
          var translation =
            jMask.translation[
              mask.charAt(Math.min(originalCaretPos - 1, mask.length - 1))
            ];

          return !translation
            ? p.caretPos(originalCaretPos + 1, oldLength, newLength, maskDif)
            : Math.min(
                originalCaretPos + newLength - oldLength - maskDif,
                newLength
              );
        },
        behaviour: function (e) {
          e = e || window.event;
          p.invalid = [];

          var keyCode = el.data("mask-keycode");

          if ($.inArray(keyCode, jMask.byPassKeys) === -1) {
            var caretPos = p.getCaret(),
              currVal = p.val(),
              currValL = currVal.length,
              newVal = p.getMasked(),
              newValL = newVal.length,
              maskDif =
                p.getMCharsBeforeCount(newValL - 1) -
                p.getMCharsBeforeCount(currValL - 1),
              changeCaret = caretPos < currValL;

            p.val(newVal);

            if (changeCaret) {
              // Avoid adjusting caret on backspace or delete
              if (!(keyCode === 8 || keyCode === 46)) {
                caretPos = p.caretPos(caretPos, currValL, newValL, maskDif);
              }
              p.setCaret(caretPos);
            }

            return p.callbacks(e);
          }
        },
        getMasked: function (skipMaskChars, val) {
          var buf = [],
            value = val === undefined ? p.val() : val + "",
            m = 0,
            maskLen = mask.length,
            v = 0,
            valLen = value.length,
            offset = 1,
            addMethod = "push",
            resetPos = -1,
            lastMaskChar,
            check;

          if (options.reverse) {
            addMethod = "unshift";
            offset = -1;
            lastMaskChar = 0;
            m = maskLen - 1;
            v = valLen - 1;
            check = function () {
              return m > -1 && v > -1;
            };
          } else {
            lastMaskChar = maskLen - 1;
            check = function () {
              return m < maskLen && v < valLen;
            };
          }

          while (check()) {
            var maskDigit = mask.charAt(m),
              valDigit = value.charAt(v),
              translation = jMask.translation[maskDigit];

            if (translation) {
              if (valDigit.match(translation.pattern)) {
                buf[addMethod](valDigit);
                if (translation.recursive) {
                  if (resetPos === -1) {
                    resetPos = m;
                  } else if (m === lastMaskChar) {
                    m = resetPos - offset;
                  }

                  if (lastMaskChar === resetPos) {
                    m -= offset;
                  }
                }
                m += offset;
              } else if (translation.optional) {
                m += offset;
                v -= offset;
              } else if (translation.fallback) {
                buf[addMethod](translation.fallback);
                m += offset;
                v -= offset;
              } else {
                p.invalid.push({ p: v, v: valDigit, e: translation.pattern });
              }
              v += offset;
            } else {
              if (!skipMaskChars) {
                buf[addMethod](maskDigit);
              }

              if (valDigit === maskDigit) {
                v += offset;
              }

              m += offset;
            }
          }

          var lastMaskCharDigit = mask.charAt(lastMaskChar);
          if (maskLen === valLen + 1 && !jMask.translation[lastMaskCharDigit]) {
            buf.push(lastMaskCharDigit);
          }

          return buf.join("");
        },
        callbacks: function (e) {
          var val = p.val(),
            changed = val !== oldValue,
            defaultArgs = [val, e, el, options],
            callback = function (name, criteria, args) {
              if (typeof options[name] === "function" && criteria) {
                options[name].apply(this, args);
              }
            };

          callback("onChange", changed === true, defaultArgs);
          callback("onKeyPress", changed === true, defaultArgs);
          callback("onComplete", val.length === mask.length, defaultArgs);
          callback("onInvalid", p.invalid.length > 0, [
            val,
            e,
            el,
            p.invalid,
            options,
          ]);
        },
      };

      el = $(el);
      var jMask = this,
        oldValue = p.val(),
        regexMask;

      mask =
        typeof mask === "function"
          ? mask(p.val(), undefined, el, options)
          : mask;

      // public methods
      jMask.mask = mask;
      jMask.options = options;
      jMask.remove = function () {
        var caret = p.getCaret();
        p.destroyEvents();
        p.val(jMask.getCleanVal());
        p.setCaret(caret - p.getMCharsBeforeCount(caret));
        return el;
      };

      // get value without mask
      jMask.getCleanVal = function () {
        return p.getMasked(true);
      };

      // get masked value without the value being in the input or element
      jMask.getMaskedVal = function (val) {
        return p.getMasked(false, val);
      };

      jMask.init = function (onlyMask) {
        onlyMask = onlyMask || false;
        options = options || {};

        jMask.clearIfNotMatch = $.jMaskGlobals.clearIfNotMatch;
        jMask.byPassKeys = $.jMaskGlobals.byPassKeys;
        jMask.translation = $.extend(
          {},
          $.jMaskGlobals.translation,
          options.translation
        );

        jMask = $.extend(true, {}, jMask, options);

        regexMask = p.getRegexMask();

        if (onlyMask === false) {
          if (options.placeholder) {
            el.attr("placeholder", options.placeholder);
          }

          // this is necessary, otherwise if the user submit the form
          // and then press the "back" button, the autocomplete will erase
          // the data. Works fine on IE9+, FF, Opera, Safari.
          if (el.data("mask")) {
            el.attr("autocomplete", "off");
          }

          p.destroyEvents();
          p.events();

          var caret = p.getCaret();
          p.val(p.getMasked());
          p.setCaret(caret + p.getMCharsBeforeCount(caret, true));
        } else {
          p.events();
          p.val(p.getMasked());
        }
      };

      jMask.init(!el.is("input"));
    };

    $.maskWatchers = {};
    var HTMLAttributes = function () {
        var input = $(this),
          options = {},
          prefix = "data-mask-",
          mask = input.attr("data-mask");

        if (input.attr(prefix + "reverse")) {
          options.reverse = true;
        }

        if (input.attr(prefix + "clearifnotmatch")) {
          options.clearIfNotMatch = true;
        }

        if (input.attr(prefix + "selectonfocus") === "true") {
          options.selectOnFocus = true;
        }

        if (notSameMaskObject(input, mask, options)) {
          return input.data("mask", new Mask(this, mask, options));
        }
      },
      notSameMaskObject = function (field, mask, options) {
        options = options || {};
        var maskObject = $(field).data("mask"),
          stringify = JSON.stringify,
          value = $(field).val() || $(field).text();
        try {
          if (typeof mask === "function") {
            mask = mask(value);
          }
          return (
            typeof maskObject !== "object" ||
            stringify(maskObject.options) !== stringify(options) ||
            maskObject.mask !== mask
          );
        } catch (e) {}
      },
      eventSupported = function (eventName) {
        var el = document.createElement("div"),
          isSupported;

        eventName = "on" + eventName;
        isSupported = eventName in el;

        if (!isSupported) {
          el.setAttribute(eventName, "return;");
          isSupported = typeof el[eventName] === "function";
        }
        el = null;

        return isSupported;
      };

    $.fn.mask = function (mask, options) {
      options = options || {};
      var selector = this.selector,
        globals = $.jMaskGlobals,
        interval = globals.watchInterval,
        watchInputs = options.watchInputs || globals.watchInputs,
        maskFunction = function () {
          if (notSameMaskObject(this, mask, options)) {
            return $(this).data("mask", new Mask(this, mask, options));
          }
        };

      $(this).each(maskFunction);

      if (selector && selector !== "" && watchInputs) {
        clearInterval($.maskWatchers[selector]);
        $.maskWatchers[selector] = setInterval(function () {
          $(document).find(selector).each(maskFunction);
        }, interval);
      }
      return this;
    };

    $.fn.masked = function (val) {
      return this.data("mask").getMaskedVal(val);
    };

    $.fn.unmask = function () {
      clearInterval($.maskWatchers[this.selector]);
      delete $.maskWatchers[this.selector];
      return this.each(function () {
        var dataMask = $(this).data("mask");
        if (dataMask) {
          dataMask.remove().removeData("mask");
        }
      });
    };

    $.fn.cleanVal = function () {
      var data = this.data("mask");
      if (data && data.getCleanVal) {
        return this.data("mask").getCleanVal();
      }
      return this.val ? this.val() : "";
    };

    $.applyDataMask = function (selector) {
      selector = selector || $.jMaskGlobals.maskElements;
      var $selector = selector instanceof $ ? selector : $(selector);
      $selector.filter($.jMaskGlobals.dataMaskAttr).each(HTMLAttributes);
    };

    var globals = {
      maskElements: "input,td,span,div",
      dataMaskAttr: "*[data-mask]",
      dataMask: true,
      watchInterval: 300,
      watchInputs: true,
      useInput: eventSupported("input"),
      watchDataMask: false,
      byPassKeys: [9, 16, 17, 18, 36, 37, 38, 39, 40, 91],
      translation: {
        0: { pattern: /\d/ },
        9: { pattern: /\d/, optional: true },
        "#": { pattern: /\d/, recursive: true },
        A: { pattern: /[a-zA-Z0-9]/ },
        S: { pattern: /[a-zA-Z]/ },
      },
    };

    $.jMaskGlobals = $.jMaskGlobals || {};
    globals = $.jMaskGlobals = $.extend(true, {}, globals, $.jMaskGlobals);

    // looking for inputs with data-mask attribute
    if (globals.dataMask) {
      $.applyDataMask();
    }

    setInterval(function () {
      if ($.jMaskGlobals.watchDataMask) {
        $.applyDataMask();
      }
    }, globals.watchInterval);
  })(window.jQuery);
  (function () {
    /**
     * MVENTNOR 18/12/2014 - Commented out a lot of tags we won't use in order to save space
     */

    var debug = false;

    var root = this;

    var EXIF = function (obj) {
      if (obj instanceof EXIF) return obj;
      if (!(this instanceof EXIF)) return new EXIF(obj);
      this.EXIFwrapped = obj;
    };

    if (typeof exports !== "undefined") {
      if (typeof module !== "undefined" && module.exports) {
        exports = module.exports = EXIF;
      }
      exports.EXIF = EXIF;
    } else {
      root.EXIF = EXIF;
    }

    /*
    var ExifTags = EXIF.Tags = {

        // version tags
        0x9000 : "ExifVersion",             // EXIF version
        0xA000 : "FlashpixVersion",         // Flashpix format version

        // colorspace tags
        0xA001 : "ColorSpace",              // Color space information tag

        // image configuration
        0xA002 : "PixelXDimension",         // Valid width of meaningful image
        0xA003 : "PixelYDimension",         // Valid height of meaningful image
        0x9101 : "ComponentsConfiguration", // Information about channels
        0x9102 : "CompressedBitsPerPixel",  // Compressed bits per pixel

        // user information
        0x927C : "MakerNote",               // Any desired information written by the manufacturer
        0x9286 : "UserComment",             // Comments by user

        // related file
        0xA004 : "RelatedSoundFile",        // Name of related sound file

        // date and time
        0x9003 : "DateTimeOriginal",        // Date and time when the original image was generated
        0x9004 : "DateTimeDigitized",       // Date and time when the image was stored digitally
        0x9290 : "SubsecTime",              // Fractions of seconds for DateTime
        0x9291 : "SubsecTimeOriginal",      // Fractions of seconds for DateTimeOriginal
        0x9292 : "SubsecTimeDigitized",     // Fractions of seconds for DateTimeDigitized

        // picture-taking conditions
        0x829A : "ExposureTime",            // Exposure time (in seconds)
        0x829D : "FNumber",                 // F number
        0x8822 : "ExposureProgram",         // Exposure program
        0x8824 : "SpectralSensitivity",     // Spectral sensitivity
        0x8827 : "ISOSpeedRatings",         // ISO speed rating
        0x8828 : "OECF",                    // Optoelectric conversion factor
        0x9201 : "ShutterSpeedValue",       // Shutter speed
        0x9202 : "ApertureValue",           // Lens aperture
        0x9203 : "BrightnessValue",         // Value of brightness
        0x9204 : "ExposureBias",            // Exposure bias
        0x9205 : "MaxApertureValue",        // Smallest F number of lens
        0x9206 : "SubjectDistance",         // Distance to subject in meters
        0x9207 : "MeteringMode",            // Metering mode
        0x9208 : "LightSource",             // Kind of light source
        0x9209 : "Flash",                   // Flash status
        0x9214 : "SubjectArea",             // Location and area of main subject
        0x920A : "FocalLength",             // Focal length of the lens in mm
        0xA20B : "FlashEnergy",             // Strobe energy in BCPS
        0xA20C : "SpatialFrequencyResponse",    //
        0xA20E : "FocalPlaneXResolution",   // Number of pixels in width direction per FocalPlaneResolutionUnit
        0xA20F : "FocalPlaneYResolution",   // Number of pixels in height direction per FocalPlaneResolutionUnit
        0xA210 : "FocalPlaneResolutionUnit",    // Unit for measuring FocalPlaneXResolution and FocalPlaneYResolution
        0xA214 : "SubjectLocation",         // Location of subject in image
        0xA215 : "ExposureIndex",           // Exposure index selected on camera
        0xA217 : "SensingMethod",           // Image sensor type
        0xA300 : "FileSource",              // Image source (3 == DSC)
        0xA301 : "SceneType",               // Scene type (1 == directly photographed)
        0xA302 : "CFAPattern",              // Color filter array geometric pattern
        0xA401 : "CustomRendered",          // Special processing
        0xA402 : "ExposureMode",            // Exposure mode
        0xA403 : "WhiteBalance",            // 1 = auto white balance, 2 = manual
        0xA404 : "DigitalZoomRation",       // Digital zoom ratio
        0xA405 : "FocalLengthIn35mmFilm",   // Equivalent foacl length assuming 35mm film camera (in mm)
        0xA406 : "SceneCaptureType",        // Type of scene
        0xA407 : "GainControl",             // Degree of overall image gain adjustment
        0xA408 : "Contrast",                // Direction of contrast processing applied by camera
        0xA409 : "Saturation",              // Direction of saturation processing applied by camera
        0xA40A : "Sharpness",               // Direction of sharpness processing applied by camera
        0xA40B : "DeviceSettingDescription",    //
        0xA40C : "SubjectDistanceRange",    // Distance to subject

        // other tags
        0xA005 : "InteroperabilityIFDPointer",
        0xA420 : "ImageUniqueID"            // Identifier assigned uniquely to each image
    };
    */

    var TiffTags = (EXIF.TiffTags = {
      /*
        0x0100 : "ImageWidth",
        0x0101 : "ImageHeight",
        0x8769 : "ExifIFDPointer",
        0x8825 : "GPSInfoIFDPointer",
        0xA005 : "InteroperabilityIFDPointer",
        0x0102 : "BitsPerSample",
        0x0103 : "Compression",
        0x0106 : "PhotometricInterpretation",
        */
      0x0112: "Orientation",
      /*
        0x0115 : "SamplesPerPixel",
        0x011C : "PlanarConfiguration",
        0x0212 : "YCbCrSubSampling",
        0x0213 : "YCbCrPositioning",
        0x011A : "XResolution",
        0x011B : "YResolution",
        0x0128 : "ResolutionUnit",
        0x0111 : "StripOffsets",
        0x0116 : "RowsPerStrip",
        0x0117 : "StripByteCounts",
        0x0201 : "JPEGInterchangeFormat",
        0x0202 : "JPEGInterchangeFormatLength",
        0x012D : "TransferFunction",
        0x013E : "WhitePoint",
        0x013F : "PrimaryChromaticities",
        0x0211 : "YCbCrCoefficients",
        0x0214 : "ReferenceBlackWhite",
        0x0132 : "DateTime",
        0x010E : "ImageDescription",
        0x010F : "Make",
        0x0110 : "Model",
        0x0131 : "Software",
        0x013B : "Artist",
        0x8298 : "Copyright"
        */
    });

    /*
    var GPSTags = EXIF.GPSTags = {
        0x0000 : "GPSVersionID",
        0x0001 : "GPSLatitudeRef",
        0x0002 : "GPSLatitude",
        0x0003 : "GPSLongitudeRef",
        0x0004 : "GPSLongitude",
        0x0005 : "GPSAltitudeRef",
        0x0006 : "GPSAltitude",
        0x0007 : "GPSTimeStamp",
        0x0008 : "GPSSatellites",
        0x0009 : "GPSStatus",
        0x000A : "GPSMeasureMode",
        0x000B : "GPSDOP",
        0x000C : "GPSSpeedRef",
        0x000D : "GPSSpeed",
        0x000E : "GPSTrackRef",
        0x000F : "GPSTrack",
        0x0010 : "GPSImgDirectionRef",
        0x0011 : "GPSImgDirection",
        0x0012 : "GPSMapDatum",
        0x0013 : "GPSDestLatitudeRef",
        0x0014 : "GPSDestLatitude",
        0x0015 : "GPSDestLongitudeRef",
        0x0016 : "GPSDestLongitude",
        0x0017 : "GPSDestBearingRef",
        0x0018 : "GPSDestBearing",
        0x0019 : "GPSDestDistanceRef",
        0x001A : "GPSDestDistance",
        0x001B : "GPSProcessingMethod",
        0x001C : "GPSAreaInformation",
        0x001D : "GPSDateStamp",
        0x001E : "GPSDifferential"
    };

    var StringValues = EXIF.StringValues = {
        ExposureProgram : {
            0 : "Not defined",
            1 : "Manual",
            2 : "Normal program",
            3 : "Aperture priority",
            4 : "Shutter priority",
            5 : "Creative program",
            6 : "Action program",
            7 : "Portrait mode",
            8 : "Landscape mode"
        },
        MeteringMode : {
            0 : "Unknown",
            1 : "Average",
            2 : "CenterWeightedAverage",
            3 : "Spot",
            4 : "MultiSpot",
            5 : "Pattern",
            6 : "Partial",
            255 : "Other"
        },
        LightSource : {
            0 : "Unknown",
            1 : "Daylight",
            2 : "Fluorescent",
            3 : "Tungsten (incandescent light)",
            4 : "Flash",
            9 : "Fine weather",
            10 : "Cloudy weather",
            11 : "Shade",
            12 : "Daylight fluorescent (D 5700 - 7100K)",
            13 : "Day white fluorescent (N 4600 - 5400K)",
            14 : "Cool white fluorescent (W 3900 - 4500K)",
            15 : "White fluorescent (WW 3200 - 3700K)",
            17 : "Standard light A",
            18 : "Standard light B",
            19 : "Standard light C",
            20 : "D55",
            21 : "D65",
            22 : "D75",
            23 : "D50",
            24 : "ISO studio tungsten",
            255 : "Other"
        },
        Flash : {
            0x0000 : "Flash did not fire",
            0x0001 : "Flash fired",
            0x0005 : "Strobe return light not detected",
            0x0007 : "Strobe return light detected",
            0x0009 : "Flash fired, compulsory flash mode",
            0x000D : "Flash fired, compulsory flash mode, return light not detected",
            0x000F : "Flash fired, compulsory flash mode, return light detected",
            0x0010 : "Flash did not fire, compulsory flash mode",
            0x0018 : "Flash did not fire, auto mode",
            0x0019 : "Flash fired, auto mode",
            0x001D : "Flash fired, auto mode, return light not detected",
            0x001F : "Flash fired, auto mode, return light detected",
            0x0020 : "No flash function",
            0x0041 : "Flash fired, red-eye reduction mode",
            0x0045 : "Flash fired, red-eye reduction mode, return light not detected",
            0x0047 : "Flash fired, red-eye reduction mode, return light detected",
            0x0049 : "Flash fired, compulsory flash mode, red-eye reduction mode",
            0x004D : "Flash fired, compulsory flash mode, red-eye reduction mode, return light not detected",
            0x004F : "Flash fired, compulsory flash mode, red-eye reduction mode, return light detected",
            0x0059 : "Flash fired, auto mode, red-eye reduction mode",
            0x005D : "Flash fired, auto mode, return light not detected, red-eye reduction mode",
            0x005F : "Flash fired, auto mode, return light detected, red-eye reduction mode"
        },
        SensingMethod : {
            1 : "Not defined",
            2 : "One-chip color area sensor",
            3 : "Two-chip color area sensor",
            4 : "Three-chip color area sensor",
            5 : "Color sequential area sensor",
            7 : "Trilinear sensor",
            8 : "Color sequential linear sensor"
        },
        SceneCaptureType : {
            0 : "Standard",
            1 : "Landscape",
            2 : "Portrait",
            3 : "Night scene"
        },
        SceneType : {
            1 : "Directly photographed"
        },
        CustomRendered : {
            0 : "Normal process",
            1 : "Custom process"
        },
        WhiteBalance : {
            0 : "Auto white balance",
            1 : "Manual white balance"
        },
        GainControl : {
            0 : "None",
            1 : "Low gain up",
            2 : "High gain up",
            3 : "Low gain down",
            4 : "High gain down"
        },
        Contrast : {
            0 : "Normal",
            1 : "Soft",
            2 : "Hard"
        },
        Saturation : {
            0 : "Normal",
            1 : "Low saturation",
            2 : "High saturation"
        },
        Sharpness : {
            0 : "Normal",
            1 : "Soft",
            2 : "Hard"
        },
        SubjectDistanceRange : {
            0 : "Unknown",
            1 : "Macro",
            2 : "Close view",
            3 : "Distant view"
        },
        FileSource : {
            3 : "DSC"
        },

        Components : {
            0 : "",
            1 : "Y",
            2 : "Cb",
            3 : "Cr",
            4 : "R",
            5 : "G",
            6 : "B"
        }
    };
    */

    function addEvent(element, event, handler) {
      if (element.addEventListener) {
        element.addEventListener(event, handler, false);
      } else if (element.attachEvent) {
        element.attachEvent("on" + event, handler);
      }
    }

    function imageHasData(img) {
      return !!img.exifdata;
    }

    function base64ToArrayBuffer(base64, contentType) {
      contentType =
        contentType || base64.match(/^data\:([^\;]+)\;base64,/im)[1] || ""; // e.g. 'data:image/jpeg;base64,...' => 'image/jpeg'
      base64 = base64.replace(/^data\:([^\;]+)\;base64,/gim, "");
      var binary = atob(base64);
      var len = binary.length;
      var buffer = new ArrayBuffer(len);
      var view = new Uint8Array(buffer);
      for (var i = 0; i < len; i++) {
        view[i] = binary.charCodeAt(i);
      }
      return buffer;
    }

    function objectURLToBlob(url, callback) {
      var http = new XMLHttpRequest();
      http.open("GET", url, true);
      http.responseType = "blob";
      http.onload = function (e) {
        if (this.status == 200 || this.status === 0) {
          callback(this.response);
        }
      };
      http.send();
    }

    function getImageData(img, callback) {
      function handleBinaryFile(binFile) {
        var data = findEXIFinJPEG(binFile);
        var iptcdata = findIPTCinJPEG(binFile);
        img.exifdata = data || {};
        img.iptcdata = iptcdata || {};
        if (callback) {
          callback.call(img);
        }
      }

      if (img.src) {
        if (/^data\:/i.test(img.src)) {
          // Data URI
          var arrayBuffer = base64ToArrayBuffer(img.src);
          handleBinaryFile(arrayBuffer);
        } else if (/^blob\:/i.test(img.src)) {
          // Object URL
          var fileReader = new FileReader();
          fileReader.onload = function (e) {
            handleBinaryFile(e.target.result);
          };
          objectURLToBlob(img.src, function (blob) {
            fileReader.readAsArrayBuffer(blob);
          });
        } else {
          var http = new XMLHttpRequest();
          http.onload = function () {
            if (this.status == 200 || this.status === 0) {
              handleBinaryFile(http.response);
            } else {
              throw "Could not load image";
            }
            http = null;
          };
          http.open("GET", img.src, true);
          http.responseType = "arraybuffer";
          http.send(null);
        }
      } else if (
        window.FileReader &&
        (img instanceof window.Blob || img instanceof window.File)
      ) {
        var fileReader = new FileReader();
        fileReader.onload = function (e) {
          if (debug)
            console.log("Got file of length " + e.target.result.byteLength);
          handleBinaryFile(e.target.result);
        };

        fileReader.readAsArrayBuffer(img);
      }
    }

    function findEXIFinJPEG(file) {
      var dataView = new DataView(file);

      if (debug) console.log("Got file of length " + file.byteLength);
      if (dataView.getUint8(0) != 0xff || dataView.getUint8(1) != 0xd8) {
        if (debug) console.log("Not a valid JPEG");
        return false; // not a valid jpeg
      }

      var offset = 2,
        length = file.byteLength,
        marker;

      while (offset < length) {
        if (dataView.getUint8(offset) != 0xff) {
          if (debug)
            console.log(
              "Not a valid marker at offset " +
                offset +
                ", found: " +
                dataView.getUint8(offset)
            );
          return false; // not a valid marker, something is wrong
        }

        marker = dataView.getUint8(offset + 1);
        if (debug) console.log(marker);

        // we could implement handling for other markers here,
        // but we're only looking for 0xFFE1 for EXIF data

        if (marker == 225) {
          if (debug) console.log("Found 0xFFE1 marker");

          return readEXIFData(
            dataView,
            offset + 4,
            dataView.getUint16(offset + 2) - 2
          );

          // offset += 2 + file.getShortAt(offset+2, true);
        } else {
          offset += 2 + dataView.getUint16(offset + 2);
        }
      }
    }

    function findIPTCinJPEG(file) {
      var dataView = new DataView(file);

      if (debug) console.log("Got file of length " + file.byteLength);
      if (dataView.getUint8(0) != 0xff || dataView.getUint8(1) != 0xd8) {
        if (debug) console.log("Not a valid JPEG");
        return false; // not a valid jpeg
      }

      var offset = 2,
        length = file.byteLength;

      var isFieldSegmentStart = function (dataView, offset) {
        return (
          dataView.getUint8(offset) === 0x38 &&
          dataView.getUint8(offset + 1) === 0x42 &&
          dataView.getUint8(offset + 2) === 0x49 &&
          dataView.getUint8(offset + 3) === 0x4d &&
          dataView.getUint8(offset + 4) === 0x04 &&
          dataView.getUint8(offset + 5) === 0x04
        );
      };

      while (offset < length) {
        if (isFieldSegmentStart(dataView, offset)) {
          // Get the length of the name header (which is padded to an even number of bytes)
          var nameHeaderLength = dataView.getUint8(offset + 7);
          if (nameHeaderLength % 2 !== 0) nameHeaderLength += 1;
          // Check for pre photoshop 6 format
          if (nameHeaderLength === 0) {
            // Always 4
            nameHeaderLength = 4;
          }

          var startOffset = offset + 8 + nameHeaderLength;
          var sectionLength = dataView.getUint16(offset + 6 + nameHeaderLength);

          return readIPTCData(file, startOffset, sectionLength);

          break;
        }

        // Not the marker, continue searching
        offset++;
      }
    }
    var IptcFieldMap = {
      0x78: "caption",
      0x6e: "credit",
      0x19: "keywords",
      0x37: "dateCreated",
      0x50: "byline",
      0x55: "bylineTitle",
      0x7a: "captionWriter",
      0x69: "headline",
      0x74: "copyright",
      0x0f: "category",
    };
    function readIPTCData(file, startOffset, sectionLength) {
      var dataView = new DataView(file);
      var data = {};
      var fieldValue, fieldName, dataSize, segmentType, segmentSize;
      var segmentStartPos = startOffset;
      while (segmentStartPos < startOffset + sectionLength) {
        if (
          dataView.getUint8(segmentStartPos) === 0x1c &&
          dataView.getUint8(segmentStartPos + 1) === 0x02
        ) {
          segmentType = dataView.getUint8(segmentStartPos + 2);
          if (segmentType in IptcFieldMap) {
            dataSize = dataView.getInt16(segmentStartPos + 3);
            segmentSize = dataSize + 5;
            fieldName = IptcFieldMap[segmentType];
            fieldValue = getStringFromDB(
              dataView,
              segmentStartPos + 5,
              dataSize
            );
            // Check if we already stored a value with this name
            if (data.hasOwnProperty(fieldName)) {
              // Value already stored with this name, create multivalue field
              if (data[fieldName] instanceof Array) {
                data[fieldName].push(fieldValue);
              } else {
                data[fieldName] = [data[fieldName], fieldValue];
              }
            } else {
              data[fieldName] = fieldValue;
            }
          }
        }
        segmentStartPos++;
      }
      return data;
    }

    function readTags(file, tiffStart, dirStart, strings, bigEnd) {
      var entries = file.getUint16(dirStart, !bigEnd),
        tags = {},
        entryOffset,
        tag,
        i;

      for (i = 0; i < entries; i++) {
        entryOffset = dirStart + i * 12 + 2;
        tag = strings[file.getUint16(entryOffset, !bigEnd)];
        if (!tag && debug)
          console.log("Unknown tag: " + file.getUint16(entryOffset, !bigEnd));
        tags[tag] = readTagValue(
          file,
          entryOffset,
          tiffStart,
          dirStart,
          bigEnd
        );
      }
      return tags;
    }

    function readTagValue(file, entryOffset, tiffStart, dirStart, bigEnd) {
      var type = file.getUint16(entryOffset + 2, !bigEnd),
        numValues = file.getUint32(entryOffset + 4, !bigEnd),
        valueOffset = file.getUint32(entryOffset + 8, !bigEnd) + tiffStart,
        offset,
        vals,
        val,
        n,
        numerator,
        denominator;

      switch (type) {
        case 1: // byte, 8-bit unsigned int
        case 7: // undefined, 8-bit byte, value depending on field
          if (numValues == 1) {
            return file.getUint8(entryOffset + 8, !bigEnd);
          } else {
            offset = numValues > 4 ? valueOffset : entryOffset + 8;
            vals = [];
            for (n = 0; n < numValues; n++) {
              vals[n] = file.getUint8(offset + n);
            }
            return vals;
          }

        case 2: // ascii, 8-bit byte
          offset = numValues > 4 ? valueOffset : entryOffset + 8;
          return getStringFromDB(file, offset, numValues - 1);

        case 3: // short, 16 bit int
          if (numValues == 1) {
            return file.getUint16(entryOffset + 8, !bigEnd);
          } else {
            offset = numValues > 2 ? valueOffset : entryOffset + 8;
            vals = [];
            for (n = 0; n < numValues; n++) {
              vals[n] = file.getUint16(offset + 2 * n, !bigEnd);
            }
            return vals;
          }

        case 4: // long, 32 bit int
          if (numValues == 1) {
            return file.getUint32(entryOffset + 8, !bigEnd);
          } else {
            vals = [];
            for (n = 0; n < numValues; n++) {
              vals[n] = file.getUint32(valueOffset + 4 * n, !bigEnd);
            }
            return vals;
          }

        case 5: // rational = two long values, first is numerator, second is denominator
          if (numValues == 1) {
            numerator = file.getUint32(valueOffset, !bigEnd);
            denominator = file.getUint32(valueOffset + 4, !bigEnd);
            val = new Number(numerator / denominator);
            val.numerator = numerator;
            val.denominator = denominator;
            return val;
          } else {
            vals = [];
            for (n = 0; n < numValues; n++) {
              numerator = file.getUint32(valueOffset + 8 * n, !bigEnd);
              denominator = file.getUint32(valueOffset + 4 + 8 * n, !bigEnd);
              vals[n] = new Number(numerator / denominator);
              vals[n].numerator = numerator;
              vals[n].denominator = denominator;
            }
            return vals;
          }

        case 9: // slong, 32 bit signed int
          if (numValues == 1) {
            return file.getInt32(entryOffset + 8, !bigEnd);
          } else {
            vals = [];
            for (n = 0; n < numValues; n++) {
              vals[n] = file.getInt32(valueOffset + 4 * n, !bigEnd);
            }
            return vals;
          }

        case 10: // signed rational, two slongs, first is numerator, second is denominator
          if (numValues == 1) {
            return (
              file.getInt32(valueOffset, !bigEnd) /
              file.getInt32(valueOffset + 4, !bigEnd)
            );
          } else {
            vals = [];
            for (n = 0; n < numValues; n++) {
              vals[n] =
                file.getInt32(valueOffset + 8 * n, !bigEnd) /
                file.getInt32(valueOffset + 4 + 8 * n, !bigEnd);
            }
            return vals;
          }
      }
    }

    function getStringFromDB(buffer, start, length) {
      var outstr = "";
      for (n = start; n < start + length; n++) {
        outstr += String.fromCharCode(buffer.getUint8(n));
      }
      return outstr;
    }

    function readEXIFData(file, start) {
      if (getStringFromDB(file, start, 4) != "Exif") {
        if (debug)
          console.log(
            "Not valid EXIF data! " + getStringFromDB(file, start, 4)
          );
        return false;
      }

      var bigEnd,
        tags,
        tag,
        exifData,
        gpsData,
        tiffOffset = start + 6;

      // test for TIFF validity and endianness
      if (file.getUint16(tiffOffset) == 0x4949) {
        bigEnd = false;
      } else if (file.getUint16(tiffOffset) == 0x4d4d) {
        bigEnd = true;
      } else {
        if (debug) console.log("Not valid TIFF data! (no 0x4949 or 0x4D4D)");
        return false;
      }

      if (file.getUint16(tiffOffset + 2, !bigEnd) != 0x002a) {
        if (debug) console.log("Not valid TIFF data! (no 0x002A)");
        return false;
      }

      var firstIFDOffset = file.getUint32(tiffOffset + 4, !bigEnd);

      if (firstIFDOffset < 0x00000008) {
        if (debug)
          console.log(
            "Not valid TIFF data! (First offset less than 8)",
            file.getUint32(tiffOffset + 4, !bigEnd)
          );
        return false;
      }

      tags = readTags(
        file,
        tiffOffset,
        tiffOffset + firstIFDOffset,
        TiffTags,
        bigEnd
      );

      if (tags.ExifIFDPointer) {
        exifData = readTags(
          file,
          tiffOffset,
          tiffOffset + tags.ExifIFDPointer,
          ExifTags,
          bigEnd
        );
        for (tag in exifData) {
          switch (tag) {
            case "LightSource":
            case "Flash":
            case "MeteringMode":
            case "ExposureProgram":
            case "SensingMethod":
            case "SceneCaptureType":
            case "SceneType":
            case "CustomRendered":
            case "WhiteBalance":
            case "GainControl":
            case "Contrast":
            case "Saturation":
            case "Sharpness":
            case "SubjectDistanceRange":
            case "FileSource":
              exifData[tag] = StringValues[tag][exifData[tag]];
              break;

            case "ExifVersion":
            case "FlashpixVersion":
              exifData[tag] = String.fromCharCode(
                exifData[tag][0],
                exifData[tag][1],
                exifData[tag][2],
                exifData[tag][3]
              );
              break;

            case "ComponentsConfiguration":
              exifData[tag] =
                StringValues.Components[exifData[tag][0]] +
                StringValues.Components[exifData[tag][1]] +
                StringValues.Components[exifData[tag][2]] +
                StringValues.Components[exifData[tag][3]];
              break;
          }
          tags[tag] = exifData[tag];
        }
      }

      if (tags.GPSInfoIFDPointer) {
        gpsData = readTags(
          file,
          tiffOffset,
          tiffOffset + tags.GPSInfoIFDPointer,
          GPSTags,
          bigEnd
        );
        for (tag in gpsData) {
          switch (tag) {
            case "GPSVersionID":
              gpsData[tag] =
                gpsData[tag][0] +
                "." +
                gpsData[tag][1] +
                "." +
                gpsData[tag][2] +
                "." +
                gpsData[tag][3];
              break;
          }
          tags[tag] = gpsData[tag];
        }
      }

      return tags;
    }

    EXIF.getData = function (img, callback) {
      if (
        (img instanceof Image || img instanceof HTMLImageElement) &&
        !img.complete
      )
        return false;

      if (!imageHasData(img)) {
        getImageData(img, callback);
      } else {
        if (callback) {
          callback.call(img);
        }
      }
      return true;
    };

    EXIF.getTag = function (img, tag) {
      if (!imageHasData(img)) return;
      return img.exifdata[tag];
    };

    EXIF.getAllTags = function (img) {
      if (!imageHasData(img)) return {};
      var a,
        data = img.exifdata,
        tags = {};
      for (a in data) {
        if (data.hasOwnProperty(a)) {
          tags[a] = data[a];
        }
      }
      return tags;
    };

    EXIF.pretty = function (img) {
      if (!imageHasData(img)) return "";
      var a,
        data = img.exifdata,
        strPretty = "";
      for (a in data) {
        if (data.hasOwnProperty(a)) {
          if (typeof data[a] == "object") {
            if (data[a] instanceof Number) {
              strPretty +=
                a +
                " : " +
                data[a] +
                " [" +
                data[a].numerator +
                "/" +
                data[a].denominator +
                "]\r\n";
            } else {
              strPretty += a + " : [" + data[a].length + " values]\r\n";
            }
          } else {
            strPretty += a + " : " + data[a] + "\r\n";
          }
        }
      }
      return strPretty;
    };

    EXIF.readFromBinaryFile = function (file) {
      return findEXIFinJPEG(file);
    };

    if (typeof define === "function" && define.amd) {
      define("exif-js", [], function () {
        return EXIF;
      });
    }
  }).call(this);

  /**
   * Created by jonikang on 16/5/17.
   */
  (function e(t, n, r) {
    function s(o, u) {
      if (!n[o]) {
        if (!t[o]) {
          var a = typeof require == "function" && require;
          if (!u && a) return a(o, !0);
          if (i) return i(o, !0);
          var f = new Error("Cannot find module '" + o + "'");
          throw ((f.code = "MODULE_NOT_FOUND"), f);
        }
        var l = (n[o] = { exports: {} });
        t[o][0].call(
          l.exports,
          function (e) {
            var n = t[o][1][e];
            return s(n ? n : e);
          },
          l,
          l.exports,
          e,
          t,
          n,
          r
        );
      }
      return n[o].exports;
    }
    var i = typeof require == "function" && require;
    for (var o = 0; o < r.length; o++) s(r[o]);
    return s;
  })(
    {
      1: [
        function (require, module, exports) {
          /**
           * The code was extracted from:
           * https://github.com/davidchambers/Base64.js
           */

          var chars =
            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";

          function InvalidCharacterError(message) {
            this.message = message;
          }

          InvalidCharacterError.prototype = new Error();
          InvalidCharacterError.prototype.name = "InvalidCharacterError";

          function polyfill(input) {
            var str = String(input).replace(/=+$/, "");
            if (str.length % 4 == 1) {
              throw new InvalidCharacterError(
                "'atob' failed: The string to be decoded is not correctly encoded."
              );
            }
            for (
              // initialize result and counters
              var bc = 0, bs, buffer, idx = 0, output = "";
              // get next character
              (buffer = str.charAt(idx++));
              // character found in table? initialize bit storage and add its ascii value;
              ~buffer &&
              ((bs = bc % 4 ? bs * 64 + buffer : buffer),
              // and if not first of each 4 characters,
              // convert the first 8 bits to one ascii character
              bc++ % 4)
                ? (output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6))))
                : 0
            ) {
              // try to find character in table (0-63, not found => -1)
              buffer = chars.indexOf(buffer);
            }
            return output;
          }

          module.exports =
            (typeof window !== "undefined" &&
              window.atob &&
              window.atob.bind(window)) ||
            polyfill;
        },
        {},
      ],
      2: [
        function (require, module, exports) {
          var atob = require("./atob");

          function b64DecodeUnicode(str) {
            return decodeURIComponent(
              atob(str).replace(/(.)/g, function (m, p) {
                var code = p.charCodeAt(0).toString(16).toUpperCase();
                if (code.length < 2) {
                  code = "0" + code;
                }
                return "%" + code;
              })
            );
          }

          module.exports = function (str) {
            var output = str.replace(/-/g, "+").replace(/_/g, "/");
            switch (output.length % 4) {
              case 0:
                break;
              case 2:
                output += "==";
                break;
              case 3:
                output += "=";
                break;
              default:
                throw "Illegal base64url string!";
            }

            try {
              return b64DecodeUnicode(output);
            } catch (err) {
              return atob(output);
            }
          };
        },
        { "./atob": 1 },
      ],
      3: [
        function (require, module, exports) {
          "use strict";

          var base64_url_decode = require("./base64_url_decode");

          function InvalidTokenError(message) {
            this.message = message;
          }

          InvalidTokenError.prototype = new Error();
          InvalidTokenError.prototype.name = "InvalidTokenError";

          module.exports = function (token, options) {
            if (typeof token !== "string") {
              throw new InvalidTokenError("Invalid token specified");
            }

            options = options || {};
            var pos = options.header === true ? 0 : 1;
            try {
              return JSON.parse(base64_url_decode(token.split(".")[pos]));
            } catch (e) {
              throw new InvalidTokenError(
                "Invalid token specified: " + e.message
              );
            }
          };

          module.exports.InvalidTokenError = InvalidTokenError;
        },
        { "./base64_url_decode": 2 },
      ],
      4: [
        function (require, module, exports) {
          (function (global) {
            /*
             *
             * This is used to build the bundle with browserify.
             *
             * The bundle is used by people who doesn't use browserify.
             * Those who use browserify will install with npm and require the module,
             * the package.json file points to index.js.
             */
            var jwt_decode = require("./lib/index");

            //use amd or just throught to window object.
            //         if (typeof global.window.define == 'function' && global.window.define.amd) {
            //             global.window.define('jwt_decode', function () { return jwt_decode; });
            //         } else if (global.window) {
            global.window.jwt_decode = jwt_decode;
            // }
          }).call(
            this,
            typeof global !== "undefined"
              ? global
              : typeof self !== "undefined"
              ? self
              : typeof window !== "undefined"
              ? window
              : {}
          );
        },
        { "./lib/index": 3 },
      ],
    },
    {},
    [4]
  );
  this.jwt_decode = window.jwt_decode;
  /*! JsBarcode v3.6.0 | (c) Johan Lindell | MIT license */
  !(function (t) {
    function e(r) {
      if (n[r]) return n[r].exports;
      var o = (n[r] = { i: r, l: !1, exports: {} });
      return t[r].call(o.exports, o, o.exports, e), (o.l = !0), o.exports;
    }
    var n = {};
    return (
      (e.m = t),
      (e.c = n),
      (e.i = function (t) {
        return t;
      }),
      (e.d = function (t, e, n) {
        Object.defineProperty(t, e, {
          configurable: !1,
          enumerable: !0,
          get: n,
        });
      }),
      (e.n = function (t) {
        var n =
          t && t.__esModule
            ? function () {
                return t["default"];
              }
            : function () {
                return t;
              };
        return e.d(n, "a", n), n;
      }),
      (e.o = function (t, e) {
        return Object.prototype.hasOwnProperty.call(t, e);
      }),
      (e.p = ""),
      e((e.s = 22))
    );
  })([
    function (t, e) {
      "use strict";
      function n(t, e) {
        var n,
          r = {};
        for (n in t) t.hasOwnProperty(n) && (r[n] = t[n]);
        for (n in e)
          e.hasOwnProperty(n) && "undefined" != typeof e[n] && (r[n] = e[n]);
        return r;
      }
      Object.defineProperty(e, "__esModule", { value: !0 }), (e["default"] = n);
    },
    function (t, e, n) {
      "use strict";
      function r(t) {
        return t && t.__esModule ? t : { default: t };
      }
      function o(t, e) {
        if (!(t instanceof e))
          throw new TypeError("Cannot call a class as a function");
      }
      function i(t, e) {
        if (!t)
          throw new ReferenceError(
            "this hasn't been initialised - super() hasn't been called"
          );
        return !e || ("object" != typeof e && "function" != typeof e) ? t : e;
      }
      function a(t, e) {
        if ("function" != typeof e && null !== e)
          throw new TypeError(
            "Super expression must either be null or a function, not " +
              typeof e
          );
        (t.prototype = Object.create(e && e.prototype, {
          constructor: {
            value: t,
            enumerable: !1,
            writable: !0,
            configurable: !0,
          },
        })),
          e &&
            (Object.setPrototypeOf
              ? Object.setPrototypeOf(t, e)
              : (t.__proto__ = e));
      }
      Object.defineProperty(e, "__esModule", { value: !0 });
      var s = n(11),
        u = r(s),
        f = (function (t) {
          function e(n, r) {
            o(this, e);
            var a = i(this, t.call(this, n.substring(1), r));
            a.bytes = [];
            for (var s = 0; s < n.length; ++s) a.bytes.push(n.charCodeAt(s));
            return (
              (a.encodings = [
                740, 644, 638, 176, 164, 100, 224, 220, 124, 608, 604, 572, 436,
                244, 230, 484, 260, 254, 650, 628, 614, 764, 652, 902, 868, 836,
                830, 892, 844, 842, 752, 734, 590, 304, 112, 94, 416, 128, 122,
                672, 576, 570, 464, 422, 134, 496, 478, 142, 910, 678, 582, 768,
                762, 774, 880, 862, 814, 896, 890, 818, 914, 602, 930, 328, 292,
                200, 158, 68, 62, 424, 412, 232, 218, 76, 74, 554, 616, 978,
                556, 146, 340, 212, 182, 508, 268, 266, 956, 940, 938, 758, 782,
                974, 400, 310, 118, 512, 506, 960, 954, 502, 518, 886, 966, 668,
                680, 692, 5379,
              ]),
              a
            );
          }
          return (
            a(e, t),
            (e.prototype.encode = function () {
              var t,
                e = this.bytes,
                n = e.shift() - 105;
              if (103 === n) t = this.nextA(e, 1);
              else if (104 === n) t = this.nextB(e, 1);
              else {
                if (105 !== n) throw new c();
                t = this.nextC(e, 1);
              }
              return {
                text:
                  this.text == this.data
                    ? this.text.replace(/[^\x20-\x7E]/g, "")
                    : this.text,
                data:
                  this.getEncoding(n) +
                  t.result +
                  this.getEncoding((t.checksum + n) % 103) +
                  this.getEncoding(106),
              };
            }),
            (e.prototype.getEncoding = function (t) {
              return this.encodings[t]
                ? (this.encodings[t] + 1e3).toString(2)
                : "";
            }),
            (e.prototype.valid = function () {
              return this.data.search(/^[\x00-\x7F\xC8-\xD3]+$/) !== -1;
            }),
            (e.prototype.nextA = function (t, e) {
              if (t.length <= 0) return { result: "", checksum: 0 };
              var n, r;
              if (t[0] >= 200)
                (r = t[0] - 105),
                  t.shift(),
                  99 === r
                    ? (n = this.nextC(t, e + 1))
                    : 100 === r
                    ? (n = this.nextB(t, e + 1))
                    : 98 === r
                    ? ((t[0] = t[0] > 95 ? t[0] - 96 : t[0]),
                      (n = this.nextA(t, e + 1)))
                    : (n = this.nextA(t, e + 1));
              else {
                var o = t[0];
                (r = o < 32 ? o + 64 : o - 32),
                  t.shift(),
                  (n = this.nextA(t, e + 1));
              }
              var i = this.getEncoding(r),
                a = r * e;
              return { result: i + n.result, checksum: a + n.checksum };
            }),
            (e.prototype.nextB = function (t, e) {
              if (t.length <= 0) return { result: "", checksum: 0 };
              var n, r;
              t[0] >= 200
                ? ((r = t[0] - 105),
                  t.shift(),
                  99 === r
                    ? (n = this.nextC(t, e + 1))
                    : 101 === r
                    ? (n = this.nextA(t, e + 1))
                    : 98 === r
                    ? ((t[0] = t[0] < 32 ? t[0] + 96 : t[0]),
                      (n = this.nextB(t, e + 1)))
                    : (n = this.nextB(t, e + 1)))
                : ((r = t[0] - 32), t.shift(), (n = this.nextB(t, e + 1)));
              var o = this.getEncoding(r),
                i = r * e;
              return { result: o + n.result, checksum: i + n.checksum };
            }),
            (e.prototype.nextC = function (t, e) {
              if (t.length <= 0) return { result: "", checksum: 0 };
              var n, r;
              t[0] >= 200
                ? ((r = t[0] - 105),
                  t.shift(),
                  (n =
                    100 === r
                      ? this.nextB(t, e + 1)
                      : 101 === r
                      ? this.nextA(t, e + 1)
                      : this.nextC(t, e + 1)))
                : ((r = 10 * (t[0] - 48) + t[1] - 48),
                  t.shift(),
                  t.shift(),
                  (n = this.nextC(t, e + 1)));
              var o = this.getEncoding(r),
                i = r * e;
              return { result: o + n.result, checksum: i + n.checksum };
            }),
            e
          );
        })(u["default"]),
        c = (function (t) {
          function e() {
            o(this, e);
            var n = i(this, t.call(this));
            return (
              (n.name = "InvalidStartCharacterException"),
              (n.message =
                "The encoding does not start with a start character."),
              n
            );
          }
          return a(e, t), e;
        })(Error);
      e["default"] = f;
    },
    function (t, e) {
      "use strict";
      function n(t, e) {
        if (!(t instanceof e))
          throw new TypeError("Cannot call a class as a function");
      }
      function r(t, e) {
        if (!t)
          throw new ReferenceError(
            "this hasn't been initialised - super() hasn't been called"
          );
        return !e || ("object" != typeof e && "function" != typeof e) ? t : e;
      }
      function o(t, e) {
        if ("function" != typeof e && null !== e)
          throw new TypeError(
            "Super expression must either be null or a function, not " +
              typeof e
          );
        (t.prototype = Object.create(e && e.prototype, {
          constructor: {
            value: t,
            enumerable: !1,
            writable: !0,
            configurable: !0,
          },
        })),
          e &&
            (Object.setPrototypeOf
              ? Object.setPrototypeOf(t, e)
              : (t.__proto__ = e));
      }
      Object.defineProperty(e, "__esModule", { value: !0 });
      var i = (function (t) {
          function e(o, i) {
            n(this, e);
            var a = r(this, t.call(this));
            return (
              (a.name = "InvalidInputException"),
              (a.symbology = o),
              (a.input = i),
              (a.message =
                '"' + a.input + '" is not a valid input for ' + a.symbology),
              a
            );
          }
          return o(e, t), e;
        })(Error),
        a = (function (t) {
          function e() {
            n(this, e);
            var o = r(this, t.call(this));
            return (
              (o.name = "InvalidElementException"),
              (o.message = "Not supported type to render on"),
              o
            );
          }
          return o(e, t), e;
        })(Error),
        s = (function (t) {
          function e() {
            n(this, e);
            var o = r(this, t.call(this));
            return (
              (o.name = "NoElementException"),
              (o.message = "No element to render on."),
              o
            );
          }
          return o(e, t), e;
        })(Error);
      (e.InvalidInputException = i),
        (e.InvalidElementException = a),
        (e.NoElementException = s);
    },
    function (t, e) {
      "use strict";
      function n(t) {
        var e = [
          "width",
          "height",
          "textMargin",
          "fontSize",
          "margin",
          "marginTop",
          "marginBottom",
          "marginLeft",
          "marginRight",
        ];
        for (var n in e)
          e.hasOwnProperty(n) &&
            ((n = e[n]),
            "string" == typeof t[n] && (t[n] = parseInt(t[n], 10)));
        return (
          "string" == typeof t.displayValue &&
            (t.displayValue = "false" != t.displayValue),
          t
        );
      }
      Object.defineProperty(e, "__esModule", { value: !0 }), (e["default"] = n);
    },
    function (t, e) {
      "use strict";
      Object.defineProperty(e, "__esModule", { value: !0 });
      var n = {
        width: 2,
        height: 100,
        format: "auto",
        displayValue: !0,
        fontOptions: "",
        font: "monospace",
        text: void 0,
        textAlign: "center",
        textPosition: "bottom",
        textMargin: 2,
        fontSize: 20,
        background: "#ffffff",
        lineColor: "#000000",
        margin: 10,
        marginTop: void 0,
        marginBottom: void 0,
        marginLeft: void 0,
        marginRight: void 0,
        valid: function () {},
      };
      e["default"] = n;
    },
    function (t, e, n) {
      "use strict";
      function r(t) {
        return t && t.__esModule ? t : { default: t };
      }
      function o(t, e) {
        return (
          e.height +
          (e.displayValue && t.text.length > 0
            ? e.fontSize + e.textMargin
            : 0) +
          e.marginTop +
          e.marginBottom
        );
      }
      function i(t, e, n) {
        if (n.displayValue && e < t) {
          if ("center" == n.textAlign) return Math.floor((t - e) / 2);
          if ("left" == n.textAlign) return 0;
          if ("right" == n.textAlign) return Math.floor(t - e);
        }
        return 0;
      }
      function a(t, e, n) {
        for (var r = 0; r < t.length; r++) {
          var a,
            s = t[r],
            u = (0, l["default"])(e, s.options);
          a = u.displayValue ? f(s.text, u, n) : 0;
          var c = s.data.length * u.width;
          (s.width = Math.ceil(Math.max(a, c))),
            (s.height = o(s, u)),
            (s.barcodePadding = i(a, c, u));
        }
      }
      function s(t) {
        for (var e = 0, n = 0; n < t.length; n++) e += t[n].width;
        return e;
      }
      function u(t) {
        for (var e = 0, n = 0; n < t.length; n++)
          t[n].height > e && (e = t[n].height);
        return e;
      }
      function f(t, e, n) {
        var r;
        (r =
          "undefined" == typeof n
            ? document.createElement("canvas").getContext("2d")
            : n),
          (r.font = e.fontOptions + " " + e.fontSize + "px " + e.font);
        var o = r.measureText(t).width;
        return o;
      }
      Object.defineProperty(e, "__esModule", { value: !0 }),
        (e.getTotalWidthOfEncodings =
          e.calculateEncodingAttributes =
          e.getBarcodePadding =
          e.getEncodingHeight =
          e.getMaximumHeightOfEncodings =
            void 0);
      var c = n(0),
        l = r(c);
      (e.getMaximumHeightOfEncodings = u),
        (e.getEncodingHeight = o),
        (e.getBarcodePadding = i),
        (e.calculateEncodingAttributes = a),
        (e.getTotalWidthOfEncodings = s);
    },
    function (t, e, n) {
      "use strict";
      Object.defineProperty(e, "__esModule", { value: !0 });
      var r = n(16);
      e["default"] = {
        CODE128: r.CODE128,
        CODE128A: r.CODE128A,
        CODE128B: r.CODE128B,
        CODE128C: r.CODE128C,
      };
    },
    function (t, e) {
      "use strict";
      function n(t, e) {
        if (!(t instanceof e))
          throw new TypeError("Cannot call a class as a function");
      }
      Object.defineProperty(e, "__esModule", { value: !0 });
      var r = (function () {
        function t(e) {
          n(this, t), (this.api = e);
        }
        return (
          (t.prototype.handleCatch = function (t) {
            if ("InvalidInputException" !== t.name) throw t;
            if (this.api._options.valid === this.api._defaults.valid)
              throw t.message;
            this.api._options.valid(!1), (this.api.render = function () {});
          }),
          (t.prototype.wrapBarcodeCall = function (t) {
            try {
              var e = t.apply(void 0, arguments);
              return this.api._options.valid(!0), e;
            } catch (n) {
              return this.handleCatch(n), this.api;
            }
          }),
          t
        );
      })();
      e["default"] = r;
    },
    function (t, e) {
      "use strict";
      function n(t) {
        return (
          (t.marginTop = t.marginTop || t.margin),
          (t.marginBottom = t.marginBottom || t.margin),
          (t.marginRight = t.marginRight || t.margin),
          (t.marginLeft = t.marginLeft || t.margin),
          t
        );
      }
      Object.defineProperty(e, "__esModule", { value: !0 }), (e["default"] = n);
    },
    function (t, e, n) {
      "use strict";
      function r(t) {
        return t && t.__esModule ? t : { default: t };
      }
      function o(t) {
        if ("string" == typeof t) return i(t);
        if (Array.isArray(t)) {
          for (var e = [], n = 0; n < t.length; n++) e.push(o(t[n]));
          return e;
        }
        if (
          "undefined" != typeof HTMLCanvasElement &&
          t instanceof HTMLImageElement
        )
          return a(t);
        if ("undefined" != typeof SVGElement && t instanceof SVGElement)
          return {
            element: t,
            options: (0, f["default"])(t),
            renderer: l["default"].SVGRenderer,
          };
        if (
          "undefined" != typeof HTMLCanvasElement &&
          t instanceof HTMLCanvasElement
        )
          return {
            element: t,
            options: (0, f["default"])(t),
            renderer: l["default"].CanvasRenderer,
          };
        if (t && t.getContext)
          return { element: t, renderer: l["default"].CanvasRenderer };
        if (
          t &&
          "object" === ("undefined" == typeof t ? "undefined" : s(t)) &&
          !t.nodeName
        )
          return { element: t, renderer: l["default"].ObjectRenderer };
        throw new d.InvalidElementException();
      }
      function i(t) {
        var e = document.querySelectorAll(t);
        if (0 !== e.length) {
          for (var n = [], r = 0; r < e.length; r++) n.push(o(e[r]));
          return n;
        }
      }
      function a(t) {
        var e = document.createElement("canvas");
        return {
          element: e,
          options: (0, f["default"])(t),
          renderer: l["default"].CanvasRenderer,
          afterRender: function () {
            t.setAttribute("src", e.toDataURL());
          },
        };
      }
      Object.defineProperty(e, "__esModule", { value: !0 });
      var s =
          "function" == typeof Symbol && "symbol" == typeof Symbol.iterator
            ? function (t) {
                return typeof t;
              }
            : function (t) {
                return t &&
                  "function" == typeof Symbol &&
                  t.constructor === Symbol
                  ? "symbol"
                  : typeof t;
              },
        u = n(17),
        f = r(u),
        c = n(19),
        l = r(c),
        d = n(2);
      e["default"] = o;
    },
    function (t, e) {
      "use strict";
      function n(t) {
        function e(t) {
          if (Array.isArray(t)) for (var r = 0; r < t.length; r++) e(t[r]);
          else (t.text = t.text || ""), (t.data = t.data || ""), n.push(t);
        }
        var n = [];
        return e(t), n;
      }
      Object.defineProperty(e, "__esModule", { value: !0 }), (e["default"] = n);
    },
    function (t, e) {
      "use strict";
      function n(t, e) {
        if (!(t instanceof e))
          throw new TypeError("Cannot call a class as a function");
      }
      Object.defineProperty(e, "__esModule", { value: !0 });
      var r = function o(t, e) {
        n(this, o),
          (this.data = t),
          (this.text = e.text || t),
          (this.options = e);
      };
      e["default"] = r;
    },
    function (t, e, n) {
      "use strict";
      function r(t) {
        return t && t.__esModule ? t : { default: t };
      }
      function o(t, e) {
        if (!(t instanceof e))
          throw new TypeError("Cannot call a class as a function");
      }
      function i(t, e) {
        if (!t)
          throw new ReferenceError(
            "this hasn't been initialised - super() hasn't been called"
          );
        return !e || ("object" != typeof e && "function" != typeof e) ? t : e;
      }
      function a(t, e) {
        if ("function" != typeof e && null !== e)
          throw new TypeError(
            "Super expression must either be null or a function, not " +
              typeof e
          );
        (t.prototype = Object.create(e && e.prototype, {
          constructor: {
            value: t,
            enumerable: !1,
            writable: !0,
            configurable: !0,
          },
        })),
          e &&
            (Object.setPrototypeOf
              ? Object.setPrototypeOf(t, e)
              : (t.__proto__ = e));
      }
      Object.defineProperty(e, "__esModule", { value: !0 });
      var s = n(1),
        u = r(s),
        f = (function (t) {
          function e(n, r) {
            return (
              o(this, e), i(this, t.call(this, String.fromCharCode(208) + n, r))
            );
          }
          return (
            a(e, t),
            (e.prototype.valid = function () {
              return this.data.search(/^[\x00-\x5F\xC8-\xCF]+$/) !== -1;
            }),
            e
          );
        })(u["default"]);
      e["default"] = f;
    },
    function (t, e, n) {
      "use strict";
      function r(t) {
        return t && t.__esModule ? t : { default: t };
      }
      function o(t, e) {
        if (!(t instanceof e))
          throw new TypeError("Cannot call a class as a function");
      }
      function i(t, e) {
        if (!t)
          throw new ReferenceError(
            "this hasn't been initialised - super() hasn't been called"
          );
        return !e || ("object" != typeof e && "function" != typeof e) ? t : e;
      }
      function a(t, e) {
        if ("function" != typeof e && null !== e)
          throw new TypeError(
            "Super expression must either be null or a function, not " +
              typeof e
          );
        (t.prototype = Object.create(e && e.prototype, {
          constructor: {
            value: t,
            enumerable: !1,
            writable: !0,
            configurable: !0,
          },
        })),
          e &&
            (Object.setPrototypeOf
              ? Object.setPrototypeOf(t, e)
              : (t.__proto__ = e));
      }
      Object.defineProperty(e, "__esModule", { value: !0 });
      var s = n(1),
        u = r(s),
        f = (function (t) {
          function e(n, r) {
            return (
              o(this, e), i(this, t.call(this, String.fromCharCode(209) + n, r))
            );
          }
          return (
            a(e, t),
            (e.prototype.valid = function () {
              return this.data.search(/^[\x20-\x7F\xC8-\xCF]+$/) !== -1;
            }),
            e
          );
        })(u["default"]);
      e["default"] = f;
    },
    function (t, e, n) {
      "use strict";
      function r(t) {
        return t && t.__esModule ? t : { default: t };
      }
      function o(t, e) {
        if (!(t instanceof e))
          throw new TypeError("Cannot call a class as a function");
      }
      function i(t, e) {
        if (!t)
          throw new ReferenceError(
            "this hasn't been initialised - super() hasn't been called"
          );
        return !e || ("object" != typeof e && "function" != typeof e) ? t : e;
      }
      function a(t, e) {
        if ("function" != typeof e && null !== e)
          throw new TypeError(
            "Super expression must either be null or a function, not " +
              typeof e
          );
        (t.prototype = Object.create(e && e.prototype, {
          constructor: {
            value: t,
            enumerable: !1,
            writable: !0,
            configurable: !0,
          },
        })),
          e &&
            (Object.setPrototypeOf
              ? Object.setPrototypeOf(t, e)
              : (t.__proto__ = e));
      }
      Object.defineProperty(e, "__esModule", { value: !0 });
      var s = n(1),
        u = r(s),
        f = (function (t) {
          function e(n, r) {
            return (
              o(this, e), i(this, t.call(this, String.fromCharCode(210) + n, r))
            );
          }
          return (
            a(e, t),
            (e.prototype.valid = function () {
              return this.data.search(/^(\xCF*[0-9]{2}\xCF*)+$/) !== -1;
            }),
            e
          );
        })(u["default"]);
      e["default"] = f;
    },
    function (t, e, n) {
      "use strict";
      function r(t) {
        return t && t.__esModule ? t : { default: t };
      }
      function o(t, e) {
        if (!(t instanceof e))
          throw new TypeError("Cannot call a class as a function");
      }
      function i(t, e) {
        if (!t)
          throw new ReferenceError(
            "this hasn't been initialised - super() hasn't been called"
          );
        return !e || ("object" != typeof e && "function" != typeof e) ? t : e;
      }
      function a(t, e) {
        if ("function" != typeof e && null !== e)
          throw new TypeError(
            "Super expression must either be null or a function, not " +
              typeof e
          );
        (t.prototype = Object.create(e && e.prototype, {
          constructor: {
            value: t,
            enumerable: !1,
            writable: !0,
            configurable: !0,
          },
        })),
          e &&
            (Object.setPrototypeOf
              ? Object.setPrototypeOf(t, e)
              : (t.__proto__ = e));
      }
      function s(t) {
        var e,
          n = t.match(/^[\x00-\x5F\xC8-\xCF]*/)[0].length,
          r = t.match(/^[\x20-\x7F\xC8-\xCF]*/)[0].length,
          o = t.match(/^(\xCF*[0-9]{2}\xCF*)*/)[0].length;
        return (
          (e =
            o >= 2
              ? String.fromCharCode(210) + c(t)
              : n > r
              ? String.fromCharCode(208) + u(t)
              : String.fromCharCode(209) + f(t)),
          (e = e.replace(/[\xCD\xCE]([^])[\xCD\xCE]/, function (t, e) {
            return String.fromCharCode(203) + e;
          }))
        );
      }
      function u(t) {
        var e = t.match(/^([\x00-\x5F\xC8-\xCF]+?)(([0-9]{2}){2,})([^0-9]|$)/);
        if (e)
          return e[1] + String.fromCharCode(204) + c(t.substring(e[1].length));
        var n = t.match(/^[\x00-\x5F\xC8-\xCF]+/);
        return n[0].length === t.length
          ? t
          : n[0] + String.fromCharCode(205) + f(t.substring(n[0].length));
      }
      function f(t) {
        var e = t.match(/^([\x20-\x7F\xC8-\xCF]+?)(([0-9]{2}){2,})([^0-9]|$)/);
        if (e)
          return e[1] + String.fromCharCode(204) + c(t.substring(e[1].length));
        var n = t.match(/^[\x20-\x7F\xC8-\xCF]+/);
        return n[0].length === t.length
          ? t
          : n[0] + String.fromCharCode(206) + u(t.substring(n[0].length));
      }
      function c(t) {
        var e = t.match(/^(\xCF*[0-9]{2}\xCF*)+/)[0],
          n = e.length;
        if (n === t.length) return t;
        t = t.substring(n);
        var r = t.match(/^[\x00-\x5F\xC8-\xCF]*/)[0].length,
          o = t.match(/^[\x20-\x7F\xC8-\xCF]*/)[0].length;
        return r >= o
          ? e + String.fromCharCode(206) + u(t)
          : e + String.fromCharCode(205) + f(t);
      }
      Object.defineProperty(e, "__esModule", { value: !0 });
      var l = n(1),
        d = r(l),
        h = (function (t) {
          function e(n, r) {
            if ((o(this, e), n.search(/^[\x00-\x7F\xC8-\xD3]+$/) !== -1))
              var a = i(this, t.call(this, s(n), r));
            else var a = i(this, t.call(this, n, r));
            return i(a);
          }
          return a(e, t), e;
        })(d["default"]);
      e["default"] = h;
    },
    function (t, e, n) {
      "use strict";
      function r(t) {
        return t && t.__esModule ? t : { default: t };
      }
      Object.defineProperty(e, "__esModule", { value: !0 }),
        (e.CODE128C = e.CODE128B = e.CODE128A = e.CODE128 = void 0);
      var o = n(15),
        i = r(o),
        a = n(12),
        s = r(a),
        u = n(13),
        f = r(u),
        c = n(14),
        l = r(c);
      (e.CODE128 = i["default"]),
        (e.CODE128A = s["default"]),
        (e.CODE128B = f["default"]),
        (e.CODE128C = l["default"]);
    },
    function (t, e, n) {
      "use strict";
      function r(t) {
        return t && t.__esModule ? t : { default: t };
      }
      function o(t) {
        var e = {};
        for (var n in u["default"])
          u["default"].hasOwnProperty(n) &&
            (t.hasAttribute("jsbarcode-" + n.toLowerCase()) &&
              (e[n] = t.getAttribute("jsbarcode-" + n.toLowerCase())),
            t.hasAttribute("data-" + n.toLowerCase()) &&
              (e[n] = t.getAttribute("data-" + n.toLowerCase())));
        return (
          (e.value =
            t.getAttribute("jsbarcode-value") || t.getAttribute("data-value")),
          (e = (0, a["default"])(e))
        );
      }
      Object.defineProperty(e, "__esModule", { value: !0 });
      var i = n(3),
        a = r(i),
        s = n(4),
        u = r(s);
      e["default"] = o;
    },
    function (t, e, n) {
      "use strict";
      function r(t) {
        return t && t.__esModule ? t : { default: t };
      }
      function o(t, e) {
        if (!(t instanceof e))
          throw new TypeError("Cannot call a class as a function");
      }
      Object.defineProperty(e, "__esModule", { value: !0 });
      var i = n(0),
        a = r(i),
        s = n(5),
        u = (function () {
          function t(e, n, r) {
            o(this, t),
              (this.canvas = e),
              (this.encodings = n),
              (this.options = r);
          }
          return (
            (t.prototype.render = function () {
              if (!this.canvas.getContext)
                throw new Error("The browser does not support canvas.");
              this.prepareCanvas();
              for (var t = 0; t < this.encodings.length; t++) {
                var e = (0, a["default"])(
                  this.options,
                  this.encodings[t].options
                );
                this.drawCanvasBarcode(e, this.encodings[t]),
                  this.drawCanvasText(e, this.encodings[t]),
                  this.moveCanvasDrawing(this.encodings[t]);
              }
              this.restoreCanvas();
            }),
            (t.prototype.prepareCanvas = function () {
              var t = this.canvas.getContext("2d");
              t.save(),
                (0, s.calculateEncodingAttributes)(
                  this.encodings,
                  this.options,
                  t
                );
              var e = (0, s.getTotalWidthOfEncodings)(this.encodings),
                n = (0, s.getMaximumHeightOfEncodings)(this.encodings);
              (this.canvas.width =
                e + this.options.marginLeft + this.options.marginRight),
                (this.canvas.height = n),
                t.clearRect(0, 0, this.canvas.width, this.canvas.height),
                this.options.background &&
                  ((t.fillStyle = this.options.background),
                  t.fillRect(0, 0, this.canvas.width, this.canvas.height)),
                t.translate(this.options.marginLeft, 0);
            }),
            (t.prototype.drawCanvasBarcode = function (t, e) {
              var n,
                r = this.canvas.getContext("2d"),
                o = e.data;
              (n =
                "top" == t.textPosition
                  ? t.marginTop + t.fontSize + t.textMargin
                  : t.marginTop),
                (r.fillStyle = t.lineColor);
              for (var i = 0; i < o.length; i++) {
                var a = i * t.width + e.barcodePadding;
                "1" === o[i]
                  ? r.fillRect(a, n, t.width, t.height)
                  : o[i] && r.fillRect(a, n, t.width, t.height * o[i]);
              }
            }),
            (t.prototype.drawCanvasText = function (t, e) {
              var n = this.canvas.getContext("2d"),
                r = t.fontOptions + " " + t.fontSize + "px " + t.font;
              if (t.displayValue) {
                var o, i;
                (i =
                  "top" == t.textPosition
                    ? t.marginTop + t.fontSize - t.textMargin
                    : t.height + t.textMargin + t.marginTop + t.fontSize),
                  (n.font = r),
                  "left" == t.textAlign || e.barcodePadding > 0
                    ? ((o = 0), (n.textAlign = "left"))
                    : "right" == t.textAlign
                    ? ((o = e.width - 1), (n.textAlign = "right"))
                    : ((o = e.width / 2), (n.textAlign = "center")),
                  n.fillText(e.text, o, i);
              }
            }),
            (t.prototype.moveCanvasDrawing = function (t) {
              var e = this.canvas.getContext("2d");
              e.translate(t.width, 0);
            }),
            (t.prototype.restoreCanvas = function () {
              var t = this.canvas.getContext("2d");
              t.restore();
            }),
            t
          );
        })();
      e["default"] = u;
    },
    function (t, e, n) {
      "use strict";
      function r(t) {
        return t && t.__esModule ? t : { default: t };
      }
      Object.defineProperty(e, "__esModule", { value: !0 });
      var o = n(18),
        i = r(o),
        a = n(21),
        s = r(a),
        u = n(20),
        f = r(u);
      e["default"] = {
        CanvasRenderer: i["default"],
        SVGRenderer: s["default"],
        ObjectRenderer: f["default"],
      };
    },
    function (t, e) {
      "use strict";
      function n(t, e) {
        if (!(t instanceof e))
          throw new TypeError("Cannot call a class as a function");
      }
      Object.defineProperty(e, "__esModule", { value: !0 });
      var r = (function () {
        function t(e, r, o) {
          n(this, t),
            (this.object = e),
            (this.encodings = r),
            (this.options = o);
        }
        return (
          (t.prototype.render = function () {
            this.object.encodings = this.encodings;
          }),
          t
        );
      })();
      e["default"] = r;
    },
    function (t, e, n) {
      "use strict";
      function r(t) {
        return t && t.__esModule ? t : { default: t };
      }
      function o(t, e) {
        if (!(t instanceof e))
          throw new TypeError("Cannot call a class as a function");
      }
      function i(t, e, n) {
        var r = document.createElementNS(l, "g");
        return (
          r.setAttribute("transform", "translate(" + t + ", " + e + ")"),
          n.appendChild(r),
          r
        );
      }
      function a(t, e) {
        t.setAttribute("style", "fill:" + e.lineColor + ";");
      }
      function s(t, e, n, r, o) {
        var i = document.createElementNS(l, "rect");
        return (
          i.setAttribute("x", t),
          i.setAttribute("y", e),
          i.setAttribute("width", n),
          i.setAttribute("height", r),
          o.appendChild(i),
          i
        );
      }
      Object.defineProperty(e, "__esModule", { value: !0 });
      var u = n(0),
        f = r(u),
        c = n(5),
        l = "http://www.w3.org/2000/svg",
        d = (function () {
          function t(e, n, r) {
            o(this, t),
              (this.svg = e),
              (this.encodings = n),
              (this.options = r);
          }
          return (
            (t.prototype.render = function () {
              var t = this.options.marginLeft;
              this.prepareSVG();
              for (var e = 0; e < this.encodings.length; e++) {
                var n = this.encodings[e],
                  r = (0, f["default"])(this.options, n.options),
                  o = i(t, r.marginTop, this.svg);
                a(o, r),
                  this.drawSvgBarcode(o, r, n),
                  this.drawSVGText(o, r, n),
                  (t += n.width);
              }
            }),
            (t.prototype.prepareSVG = function () {
              for (; this.svg.firstChild; )
                this.svg.removeChild(this.svg.firstChild);
              (0, c.calculateEncodingAttributes)(this.encodings, this.options);
              var t = (0, c.getTotalWidthOfEncodings)(this.encodings),
                e = (0, c.getMaximumHeightOfEncodings)(this.encodings),
                n = t + this.options.marginLeft + this.options.marginRight;
              this.setSvgAttributes(n, e),
                this.options.background &&
                  s(0, 0, n, e, this.svg).setAttribute(
                    "style",
                    "fill:" + this.options.background + ";"
                  );
            }),
            (t.prototype.drawSvgBarcode = function (t, e, n) {
              var r,
                o = n.data;
              r = "top" == e.textPosition ? e.fontSize + e.textMargin : 0;
              for (var i = 0, a = 0, u = 0; u < o.length; u++)
                (a = u * e.width + n.barcodePadding),
                  "1" === o[u]
                    ? i++
                    : i > 0 &&
                      (s(a - e.width * i, r, e.width * i, e.height, t),
                      (i = 0));
              i > 0 && s(a - e.width * (i - 1), r, e.width * i, e.height, t);
            }),
            (t.prototype.drawSVGText = function (t, e, n) {
              var r = document.createElementNS(l, "text");
              if (e.displayValue) {
                var o, i;
                r.setAttribute(
                  "style",
                  "font:" + e.fontOptions + " " + e.fontSize + "px " + e.font
                ),
                  (i =
                    "top" == e.textPosition
                      ? e.fontSize - e.textMargin
                      : e.height + e.textMargin + e.fontSize),
                  "left" == e.textAlign || n.barcodePadding > 0
                    ? ((o = 0), r.setAttribute("text-anchor", "start"))
                    : "right" == e.textAlign
                    ? ((o = n.width - 1), r.setAttribute("text-anchor", "end"))
                    : ((o = n.width / 2),
                      r.setAttribute("text-anchor", "middle")),
                  r.setAttribute("x", o),
                  r.setAttribute("y", i),
                  r.appendChild(document.createTextNode(n.text)),
                  t.appendChild(r);
              }
            }),
            (t.prototype.setSvgAttributes = function (t, e) {
              var n = this.svg;
              n.setAttribute("width", t + "px"),
                n.setAttribute("height", e + "px"),
                n.setAttribute("x", "0px"),
                n.setAttribute("y", "0px"),
                n.setAttribute("viewBox", "0 0 " + t + " " + e),
                n.setAttribute("xmlns", l),
                n.setAttribute("version", "1.1"),
                (n.style.transform = "translate(0,0)");
            }),
            t
          );
        })();
      e["default"] = d;
    },
    function (t, e, n) {
      "use strict";
      function r(t) {
        return t && t.__esModule ? t : { default: t };
      }
      function o(t, e) {
        O.prototype[e] =
          O.prototype[e.toUpperCase()] =
          O.prototype[e.toLowerCase()] =
            function (n, r) {
              var o = this;
              return o._errorHandler.wrapBarcodeCall(function () {
                r.text = "undefined" == typeof r.text ? void 0 : "" + r.text;
                var a = (0, l["default"])(o._options, r);
                a = (0, m["default"])(a);
                var s = t[e],
                  u = i(n, s, a);
                return o._encodings.push(u), o;
              });
            };
      }
      function i(t, e, n) {
        t = "" + t;
        var r = new e(t, n);
        if (!r.valid())
          throw new w.InvalidInputException(r.constructor.name, t);
        var o = r.encode();
        o = (0, h["default"])(o);
        for (var i = 0; i < o.length; i++)
          o[i].options = (0, l["default"])(n, o[i].options);
        return o;
      }
      function a() {
        return f["default"].CODE128 ? "CODE128" : Object.keys(f["default"])[0];
      }
      function s(t, e, n) {
        e = (0, h["default"])(e);
        for (var r = 0; r < e.length; r++)
          (e[r].options = (0, l["default"])(n, e[r].options)),
            (0, g["default"])(e[r].options);
        (0, g["default"])(n);
        var o = t.renderer,
          i = new o(t.element, e, n);
        i.render(), t.afterRender && t.afterRender();
      }
      var u = n(6),
        f = r(u),
        c = n(0),
        l = r(c),
        d = n(10),
        h = r(d),
        p = n(8),
        g = r(p),
        v = n(9),
        y = r(v),
        x = n(3),
        m = r(x),
        b = n(7),
        C = r(b),
        w = n(2),
        _ = n(4),
        E = r(_),
        O = function () {},
        A = function (t, e, n) {
          var r = new O();
          if ("undefined" == typeof t)
            throw Error("No element to render on was provided.");
          return (
            (r._renderProperties = (0, y["default"])(t)),
            (r._encodings = []),
            (r._options = E["default"]),
            (r._errorHandler = new C["default"](r)),
            "undefined" != typeof e &&
              ((n = n || {}),
              n.format || (n.format = a()),
              r.options(n)[n.format](e, n).render()),
            r
          );
        };
      A.getModule = function (t) {
        return f["default"][t];
      };
      for (var P in f["default"])
        f["default"].hasOwnProperty(P) && o(f["default"], P);
      (O.prototype.options = function (t) {
        return (this._options = (0, l["default"])(this._options, t)), this;
      }),
        (O.prototype.blank = function (t) {
          var e = "0".repeat(t);
          return this._encodings.push({ data: e }), this;
        }),
        (O.prototype.init = function () {
          if (this._renderProperties) {
            Array.isArray(this._renderProperties) ||
              (this._renderProperties = [this._renderProperties]);
            var t;
            for (var e in this._renderProperties) {
              t = this._renderProperties[e];
              var n = (0, l["default"])(this._options, t.options);
              "auto" == n.format && (n.format = a()),
                this._errorHandler.wrapBarcodeCall(function () {
                  var e = n.value,
                    r = f["default"][n.format.toUpperCase()],
                    o = i(e, r, n);
                  s(t, o, n);
                });
            }
          }
        }),
        (O.prototype.render = function () {
          if (!this._renderProperties) throw new w.NoElementException();
          if (Array.isArray(this._renderProperties))
            for (var t = 0; t < this._renderProperties.length; t++)
              s(this._renderProperties[t], this._encodings, this._options);
          else s(this._renderProperties, this._encodings, this._options);
          return this;
        }),
        (O.prototype._defaults = E["default"]),
        "undefined" != typeof window && (window.JsBarcode = A),
        "undefined" != typeof jQuery &&
          (jQuery.fn.JsBarcode = function (t, e) {
            var n = [];
            return (
              jQuery(this).each(function () {
                n.push(this);
              }),
              A(n, t, e)
            );
          }),
        (t.exports = A);
    },
  ]);
  /**
   * Combodate - 1.0.7
   * Dropdown date and time picker.
   * Converts text input into dropdowns to pick day, month, year, hour, minute and second.
   * Uses momentjs as datetime library http://momentjs.com.
   * For i18n include corresponding file from https://github.com/timrwood/moment/tree/master/lang
   *
   * Confusion at noon and midnight - see http://en.wikipedia.org/wiki/12-hour_clock#Confusion_at_noon_and_midnight
   * In combodate:
   * 12:00 pm --> 12:00 (24-h format, midday)
   * 12:00 am --> 00:00 (24-h format, midnight, start of day)
   *
   * Differs from momentjs parse rules:
   * 00:00 pm, 12:00 pm --> 12:00 (24-h format, day not change)
   * 00:00 am, 12:00 am --> 00:00 (24-h format, day not change)
   *
   *
   * Author: Vitaliy Potapov
   * Project page: http://github.com/vitalets/combodate
   * Copyright (c) 2012 Vitaliy Potapov. Released under MIT License.
   **/
  (function ($) {
    var Combodate = function (element, options) {
      this.$element = $(element);
      if (!this.$element.is("input")) {
        $.error("Combodate should be applied to INPUT element");
        return;
      }
      this.options = $.extend(
        {},
        $.fn.combodate.defaults,
        options,
        this.$element.data()
      );
      this.init();
    };

    Combodate.prototype = {
      constructor: Combodate,
      init: function () {
        this.map = {
          //key   regexp    moment.method
          day: ["D", "date"],
          month: ["M", "month"],
          year: ["Y", "year"],
          hour: ["[Hh]", "hours"],
          minute: ["m", "minutes"],
          second: ["s", "seconds"],
          ampm: ["[Aa]", ""],
        };

        this.$widget = $(this.getTemplate());

        this.initCombos();

        //update original input on change
        this.$widget.on(
          "change",
          "select",
          $.proxy(function (e) {
            1;
            this.$element.val(this.getValue()).change();
            // update days count if month or year changes
            if (this.options.smartDays) {
              if ($(e.target).is(".month") || $(e.target).is(".year")) {
                this.fillCombo("day");
              }
            }
          }, this)
        );

        // this.$widget.find('select').css('width', 'auto');

        // hide original input and insert widget
        this.$element.hide().after(this.$widget);

        // set initial value
        this.setValue(this.$element.val() || this.options.value);
      },

      /*
         Replace tokens in template with <select> elements 
        */
      getTemplate: function () {
        var tpl = this.options.template;
        var customClass = this.options.customClass;

        //first pass
        $.each(this.map, function (k, v) {
          v = v[0];
          var r = new RegExp(v + "+"),
            token = v.length > 1 ? v.substring(1, 2) : v;

          tpl = tpl.replace(r, "{" + token + "}");
        });

        //replace spaces with &nbsp;
        tpl = tpl.replace(/ /g, "&nbsp;");

        //second pass
        $.each(this.map, function (k, v) {
          v = v[0];
          var token = v.length > 1 ? v.substring(1, 2) : v;

          tpl = tpl.replace(
            "{" + token + "}",
            '<div><select class="' + k + " " + customClass + '"></select></div>'
          );
        });

        return tpl;
      },

      /*
         Initialize combos that presents in template 
        */
      initCombos: function () {
        for (var k in this.map) {
          var $c = this.$widget.find("." + k);
          // set properties like this.$day, this.$month etc.
          this["$" + k] = $c.length ? $c : null;
          // fill with items
          this.fillCombo(k);
        }
      },

      /*
         Fill combo with items 
        */
      fillCombo: function (k) {
        var $combo = this["$" + k];
        if (!$combo) {
          return;
        }

        // define method name to fill items, e.g `fillDays`
        var f = "fill" + k.charAt(0).toUpperCase() + k.slice(1);
        var items = this[f]();
        var value = $combo.val();

        $combo.empty();
        for (var i = 0; i < items.length; i++) {
          $combo.append(
            '<option value="' + items[i][0] + '">' + items[i][1] + "</option>"
          );
        }

        $combo.val(value);
      },

      /*
         Initialize items of combos. Handles `firstItem` option 
        */
      fillCommon: function (key) {
        var values = [],
          relTime;

        if (this.options.firstItem === "name") {
          //need both to support moment ver < 2 and  >= 2
          relTime = moment.relativeTime || moment.langData()._relativeTime;
          var header =
            typeof relTime[key] === "function"
              ? relTime[key](1, true, key, false)
              : relTime[key];
          //take last entry (see momentjs lang files structure)
          header = header.split(" ").reverse()[0];
          header = header[0].toUpperCase() + header.substr(1, header.length);
          values.push(["", header]);
        } else if (this.options.firstItem === "empty") {
          values.push(["", ""]);
        }
        return values;
      },

      /*
        fill day
        */
      fillDay: function () {
        var items = this.fillCommon("d"),
          name,
          i,
          twoDigit = this.options.template.indexOf("DD") !== -1,
          daysCount = 31;

        // detect days count (depends on month and year)
        // originally https://github.com/vitalets/combodate/pull/7
        if (this.options.smartDays && this.$month && this.$year) {
          var month = parseInt(this.$month.val(), 10);
          var year = parseInt(this.$year.val(), 10);

          if (!isNaN(month) && !isNaN(year)) {
            daysCount = moment([year, month]).daysInMonth();
          }
        }

        for (i = 1; i <= daysCount; i++) {
          name = twoDigit ? this.leadZero(i) : i;
          items.push([i, name]);
        }
        return items;
      },

      /*
        fill month
        */
      fillMonth: function () {
        var items = this.fillCommon("M"),
          name,
          i,
          longNames = this.options.template.indexOf("MMMM") !== -1,
          shortNames = this.options.template.indexOf("MMM") !== -1,
          twoDigit = this.options.template.indexOf("MM") !== -1;

        for (i = 0; i <= 11; i++) {
          if (longNames) {
            //see https://github.com/timrwood/momentjs.com/pull/36
            name = moment().date(1).month(i).format("MMMM");
          } else if (shortNames) {
            name = moment().date(1).month(i).format("MMM");
          } else if (twoDigit) {
            name = this.leadZero(i + 1);
          } else {
            name = i + 1;
          }
          items.push([i, name]);
        }
        return items;
      },

      /*
        fill year
        */
      fillYear: function () {
        var items = [],
          name,
          i,
          longNames = this.options.template.indexOf("YYYY") !== -1;

        for (i = this.options.maxYear; i >= this.options.minYear; i--) {
          name = longNames ? i : (i + "").substring(2);
          items[this.options.yearDescending ? "push" : "unshift"]([i, name]);
        }

        items = this.fillCommon("y").concat(items);

        return items;
      },

      /*
        fill hour
        */
      fillHour: function () {
        var items = this.fillCommon("h"),
          name,
          i,
          h12 = this.options.template.indexOf("h") !== -1,
          h24 = this.options.template.indexOf("H") !== -1,
          twoDigit = this.options.template.toLowerCase().indexOf("hh") !== -1,
          min = h12 ? 1 : 0,
          max = h12 ? 12 : 23;

        for (i = min; i <= max; i++) {
          name = twoDigit ? this.leadZero(i) : i;
          items.push([i, name]);
        }
        return items;
      },

      /*
        fill minute
        */
      fillMinute: function () {
        var items = this.fillCommon("m"),
          name,
          i,
          twoDigit = this.options.template.indexOf("mm") !== -1;

        for (i = 0; i <= 59; i += this.options.minuteStep) {
          name = twoDigit ? this.leadZero(i) : i;
          items.push([i, name]);
        }
        return items;
      },

      /*
        fill second
        */
      fillSecond: function () {
        var items = this.fillCommon("s"),
          name,
          i,
          twoDigit = this.options.template.indexOf("ss") !== -1;

        for (i = 0; i <= 59; i += this.options.secondStep) {
          name = twoDigit ? this.leadZero(i) : i;
          items.push([i, name]);
        }
        return items;
      },

      /*
        fill ampm
        */
      fillAmpm: function () {
        var ampmL = this.options.template.indexOf("a") !== -1,
          ampmU = this.options.template.indexOf("A") !== -1,
          items = [
            ["am", ampmL ? "am" : "AM"],
            ["pm", ampmL ? "pm" : "PM"],
          ];
        return items;
      },

      /*
         Returns current date value from combos. 
         If format not specified - `options.format` used.
         If format = `null` - Moment object returned.
        */
      getValue: function (format) {
        var dt,
          values = {},
          that = this,
          notSelected = false;

        //getting selected values
        $.each(this.map, function (k, v) {
          if (k === "ampm") {
            return;
          }
          var def = k === "day" ? 1 : 0;

          values[k] = that["$" + k] ? parseInt(that["$" + k].val(), 10) : def;

          if (isNaN(values[k])) {
            notSelected = true;
            return false;
          }
        });

        //if at least one visible combo not selected - return empty string
        if (notSelected) {
          return "";
        }

        //convert hours 12h --> 24h
        if (this.$ampm) {
          //12:00 pm --> 12:00 (24-h format, midday), 12:00 am --> 00:00 (24-h format, midnight, start of day)
          if (values.hour === 12) {
            values.hour = this.$ampm.val() === "am" ? 0 : 12;
          } else {
            values.hour =
              this.$ampm.val() === "am" ? values.hour : values.hour + 12;
          }
        }

        dt = moment([
          values.year,
          values.month,
          values.day,
          values.hour,
          values.minute,
          values.second,
        ]);

        //highlight invalid date
        this.highlight(dt);

        format = format === undefined ? this.options.format : format;
        if (format === null) {
          return dt.isValid() ? dt : null;
        } else {
          return dt.isValid() ? dt.format(format) : "";
        }
      },

      setValue: function (value) {
        if (!value) {
          return;
        }

        // parse in strict mode (third param `true`)
        var dt =
            typeof value === "string"
              ? moment(value, this.options.format, true)
              : moment(value),
          that = this,
          values = {};

        //function to find nearest value in select options
        function getNearest($select, value) {
          var delta = {};
          $select.children("option").each(function (i, opt) {
            var optValue = $(opt).attr("value"),
              distance;

            if (optValue === "") return;
            distance = Math.abs(optValue - value);
            if (
              typeof delta.distance === "undefined" ||
              distance < delta.distance
            ) {
              delta = { value: optValue, distance: distance };
            }
          });
          return delta.value;
        }

        if (dt.isValid()) {
          //read values from date object
          $.each(this.map, function (k, v) {
            if (k === "ampm") {
              return;
            }
            values[k] = dt[v[1]]();
          });

          if (this.$ampm) {
            //12:00 pm --> 12:00 (24-h format, midday), 12:00 am --> 00:00 (24-h format, midnight, start of day)
            if (values.hour >= 12) {
              values.ampm = "pm";
              if (values.hour > 12) {
                values.hour -= 12;
              }
            } else {
              values.ampm = "am";
              if (values.hour === 0) {
                values.hour = 12;
              }
            }
          }

          $.each(values, function (k, v) {
            //call val() for each existing combo, e.g. this.$hour.val()
            if (that["$" + k]) {
              if (
                k === "minute" &&
                that.options.minuteStep > 1 &&
                that.options.roundTime
              ) {
                v = getNearest(that["$" + k], v);
              }

              if (
                k === "second" &&
                that.options.secondStep > 1 &&
                that.options.roundTime
              ) {
                v = getNearest(that["$" + k], v);
              }

              that["$" + k].val(v);
            }
          });

          // update days count
          if (this.options.smartDays) {
            this.fillCombo("day");
          }

          this.$element.val(dt.format(this.options.format)).change();
        }
      },

      /*
         highlight combos if date is invalid
        */
      highlight: function (dt) {
        if (!dt.isValid()) {
          if (this.options.errorClass) {
            this.$widget.addClass(this.options.errorClass);
          } else {
            //store original border color
            if (!this.borderColor) {
              this.borderColor = this.$widget
                .find("select")
                .css("border-color");
            }
            this.$widget.find("select").css("border-color", "red");
          }
        } else {
          if (this.options.errorClass) {
            this.$widget.removeClass(this.options.errorClass);
          } else {
            this.$widget.find("select").css("border-color", this.borderColor);
          }
        }
      },

      leadZero: function (v) {
        return v <= 9 ? "0" + v : v;
      },

      destroy: function () {
        this.$widget.remove();
        this.$element.removeData("combodate").show();
      },

      //todo: clear method
    };

    $.fn.combodate = function (option) {
      var d,
        args = Array.apply(null, arguments);
      args.shift();

      //getValue returns date as string / object (not jQuery object)
      if (
        option === "getValue" &&
        this.length &&
        (d = this.eq(0).data("combodate"))
      ) {
        return d.getValue.apply(d, args);
      }

      return this.each(function () {
        var $this = $(this),
          data = $this.data("combodate"),
          options = typeof option == "object" && option;
        if (!data) {
          $this.data("combodate", (data = new Combodate(this, options)));
        }
        if (typeof option == "string" && typeof data[option] == "function") {
          data[option].apply(data, args);
        }
      });
    };

    $.fn.combodate.defaults = {
      //in this format value stored in original input
      format: "DD-MM-YYYY HH:mm",
      //in this format items in dropdowns are displayed
      template: "D / MMM / YYYY   H : mm",
      //initial value, can be `new Date()`
      value: null,
      minYear: 1970,
      maxYear: moment().year(),
      yearDescending: true,
      minuteStep: 5,
      secondStep: 1,
      firstItem: "name", //'name', 'empty', 'none'
      errorClass: null,
      customClass: "",
      roundTime: true, // whether to round minutes and seconds if step > 1
      smartDays: false, // whether days in combo depend on selected month: 31, 30, 28
    };
  })(window.jQuery);
  /**

 * Copyright 2015 Tim Down.

 *

 * Licensed under the Apache License, Version 2.0 (the "License");

 * you may not use this file except in compliance with the License.

 * You may obtain a copy of the License at

 *

 *      http://www.apache.org/licenses/LICENSE-2.0

 *

 * Unless required by applicable law or agreed to in writing, software

 * distributed under the License is distributed on an "AS IS" BASIS,

 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.

 * See the License for the specific language governing permissions and

 * limitations under the License.

 */

  /**

 * log4javascript

 *

 * log4javascript is a logging framework for JavaScript based on log4j

 * for Java. This file contains all core log4javascript code and is the only

 * file required to use log4javascript, unless you require support for

 * document.domain, in which case you will also need console.html, which must be

 * stored in the same directory as the main log4javascript.js file.

 *

 * Author: Tim Down <tim@log4javascript.org>

 * Version: 1.4.13

 * Edition: log4javascript

 * Build date: 23 May 2015

 * Website: http://log4javascript.org

 */

  (function (factory, root) {
    // No AMD or CommonJS support so we place log4javascript in (probably) the global variable

    root.log4javascript = factory();
  })(function () {
    // Array-related stuff. Next three methods are solely for IE5, which is missing them

    if (!Array.prototype.push) {
      Array.prototype.push = function () {
        for (var i = 0, len = arguments.length; i < len; i++) {
          this[this.length] = arguments[i];
        }

        return this.length;
      };
    }

    if (!Array.prototype.shift) {
      Array.prototype.shift = function () {
        if (this.length > 0) {
          var firstItem = this[0];

          for (var i = 0, len = this.length - 1; i < len; i++) {
            this[i] = this[i + 1];
          }

          this.length = this.length - 1;

          return firstItem;
        }
      };
    }

    if (!Array.prototype.splice) {
      Array.prototype.splice = function (startIndex, deleteCount) {
        var itemsAfterDeleted = this.slice(startIndex + deleteCount);

        var itemsDeleted = this.slice(startIndex, startIndex + deleteCount);

        this.length = startIndex;

        // Copy the arguments into a proper Array object

        var argumentsArray = [];

        for (var i = 0, len = arguments.length; i < len; i++) {
          argumentsArray[i] = arguments[i];
        }

        var itemsToAppend =
          argumentsArray.length > 2
            ? (itemsAfterDeleted = argumentsArray
                .slice(2)
                .concat(itemsAfterDeleted))
            : itemsAfterDeleted;

        for (i = 0, len = itemsToAppend.length; i < len; i++) {
          this.push(itemsToAppend[i]);
        }

        return itemsDeleted;
      };
    }

    /* ---------------------------------------------------------------------- */

    function isUndefined(obj) {
      return typeof obj == "undefined";
    }

    /* ---------------------------------------------------------------------- */

    // Custom event support

    function EventSupport() {}

    EventSupport.prototype = {
      eventTypes: [],

      eventListeners: {},

      setEventTypes: function (eventTypesParam) {
        if (eventTypesParam instanceof Array) {
          this.eventTypes = eventTypesParam;

          this.eventListeners = {};

          for (var i = 0, len = this.eventTypes.length; i < len; i++) {
            this.eventListeners[this.eventTypes[i]] = [];
          }
        } else {
          handleError(
            "log4javascript.EventSupport [" +
              this +
              "]: setEventTypes: eventTypes parameter must be an Array"
          );
        }
      },

      addEventListener: function (eventType, listener) {
        if (typeof listener == "function") {
          if (!array_contains(this.eventTypes, eventType)) {
            handleError(
              "log4javascript.EventSupport [" +
                this +
                "]: addEventListener: no event called '" +
                eventType +
                "'"
            );
          }

          this.eventListeners[eventType].push(listener);
        } else {
          handleError(
            "log4javascript.EventSupport [" +
              this +
              "]: addEventListener: listener must be a function"
          );
        }
      },

      removeEventListener: function (eventType, listener) {
        if (typeof listener == "function") {
          if (!array_contains(this.eventTypes, eventType)) {
            handleError(
              "log4javascript.EventSupport [" +
                this +
                "]: removeEventListener: no event called '" +
                eventType +
                "'"
            );
          }

          array_remove(this.eventListeners[eventType], listener);
        } else {
          handleError(
            "log4javascript.EventSupport [" +
              this +
              "]: removeEventListener: listener must be a function"
          );
        }
      },

      dispatchEvent: function (eventType, eventArgs) {
        if (array_contains(this.eventTypes, eventType)) {
          var listeners = this.eventListeners[eventType];

          for (var i = 0, len = listeners.length; i < len; i++) {
            listeners[i](this, eventType, eventArgs);
          }
        } else {
          handleError(
            "log4javascript.EventSupport [" +
              this +
              "]: dispatchEvent: no event called '" +
              eventType +
              "'"
          );
        }
      },
    };

    /* -------------------------------------------------------------------------- */

    var applicationStartDate = new Date();

    var uniqueId =
      "log4javascript_" +
      applicationStartDate.getTime() +
      "_" +
      Math.floor(Math.random() * 100000000);

    var emptyFunction = function () {};

    var newLine = "\r\n";

    var pageLoaded = false;

    // Create main log4javascript object; this will be assigned public properties

    function Log4JavaScript() {}

    Log4JavaScript.prototype = new EventSupport();

    var log4javascript = new Log4JavaScript();

    log4javascript.version = "1.4.13";

    log4javascript.edition = "log4javascript";

    /* -------------------------------------------------------------------------- */

    // Utility functions

    function toStr(obj) {
      if (obj && obj.toString) {
        return obj.toString();
      } else {
        return String(obj);
      }
    }

    function getExceptionMessage(ex) {
      if (ex.message) {
        return ex.message;
      } else if (ex.description) {
        return ex.description;
      } else {
        return toStr(ex);
      }
    }

    // Gets the portion of the URL after the last slash

    function getUrlFileName(url) {
      var lastSlashIndex = Math.max(
        url.lastIndexOf("/"),
        url.lastIndexOf("\\")
      );

      return url.substr(lastSlashIndex + 1);
    }

    // Returns a nicely formatted representation of an error

    function getExceptionStringRep(ex) {
      if (ex) {
        var exStr = "Exception: " + getExceptionMessage(ex);

        try {
          if (ex.lineNumber) {
            exStr += " on line number " + ex.lineNumber;
          }

          if (ex.fileName) {
            exStr += " in file " + getUrlFileName(ex.fileName);
          }
        } catch (localEx) {
          logLog.warn("Unable to obtain file and line information for error");
        }

        if (showStackTraces && ex.stack) {
          exStr += newLine + "Stack trace:" + newLine + ex.stack;
        }

        return exStr;
      }

      return null;
    }

    function bool(obj) {
      return Boolean(obj);
    }

    function trim(str) {
      return str.replace(/^\s+/, "").replace(/\s+$/, "");
    }

    function splitIntoLines(text) {
      // Ensure all line breaks are \n only

      var text2 = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

      return text2.split("\n");
    }

    var urlEncode =
      typeof window.encodeURIComponent != "undefined"
        ? function (str) {
            return encodeURIComponent(str);
          }
        : function (str) {
            return escape(str)
              .replace(/\+/g, "%2B")
              .replace(/"/g, "%22")
              .replace(/'/g, "%27")
              .replace(/\//g, "%2F")
              .replace(/=/g, "%3D");
          };

    function array_remove(arr, val) {
      var index = -1;

      for (var i = 0, len = arr.length; i < len; i++) {
        if (arr[i] === val) {
          index = i;

          break;
        }
      }

      if (index >= 0) {
        arr.splice(index, 1);

        return true;
      } else {
        return false;
      }
    }

    function array_contains(arr, val) {
      for (var i = 0, len = arr.length; i < len; i++) {
        if (arr[i] == val) {
          return true;
        }
      }

      return false;
    }

    function extractBooleanFromParam(param, defaultValue) {
      if (isUndefined(param)) {
        return defaultValue;
      } else {
        return bool(param);
      }
    }

    function extractStringFromParam(param, defaultValue) {
      if (isUndefined(param)) {
        return defaultValue;
      } else {
        return String(param);
      }
    }

    function extractIntFromParam(param, defaultValue) {
      if (isUndefined(param)) {
        return defaultValue;
      } else {
        try {
          var value = parseInt(param, 10);

          return isNaN(value) ? defaultValue : value;
        } catch (ex) {
          logLog.warn("Invalid int param " + param, ex);

          return defaultValue;
        }
      }
    }

    function extractFunctionFromParam(param, defaultValue) {
      if (typeof param == "function") {
        return param;
      } else {
        return defaultValue;
      }
    }

    function isError(err) {
      return err instanceof Error;
    }

    if (!Function.prototype.apply) {
      Function.prototype.apply = function (obj, args) {
        var methodName = "__apply__";

        if (typeof obj[methodName] != "undefined") {
          methodName += String(Math.random()).substr(2);
        }

        obj[methodName] = this;

        var argsStrings = [];

        for (var i = 0, len = args.length; i < len; i++) {
          argsStrings[i] = "args[" + i + "]";
        }

        var script = "obj." + methodName + "(" + argsStrings.join(",") + ")";

        var returnValue = eval(script);

        delete obj[methodName];

        return returnValue;
      };
    }

    if (!Function.prototype.call) {
      Function.prototype.call = function (obj) {
        var args = [];

        for (var i = 1, len = arguments.length; i < len; i++) {
          args[i - 1] = arguments[i];
        }

        return this.apply(obj, args);
      };
    }

    /* ---------------------------------------------------------------------- */

    // Simple logging for log4javascript itself

    var logLog = {
      quietMode: false,

      debugMessages: [],

      setQuietMode: function (quietMode) {
        this.quietMode = bool(quietMode);
      },

      numberOfErrors: 0,

      alertAllErrors: false,

      setAlertAllErrors: function (alertAllErrors) {
        this.alertAllErrors = alertAllErrors;
      },

      debug: function (message) {
        this.debugMessages.push(message);
      },

      displayDebug: function () {
        alert(this.debugMessages.join(newLine));
      },

      warn: function (message, exception) {},

      error: function (message, exception) {
        if (++this.numberOfErrors == 1 || this.alertAllErrors) {
          if (!this.quietMode) {
            var alertMessage = "log4javascript error: " + message;

            if (exception) {
              alertMessage +=
                newLine +
                newLine +
                "Original error: " +
                getExceptionStringRep(exception);
            }

            alert(alertMessage);
          }
        }
      },
    };

    log4javascript.logLog = logLog;

    log4javascript.setEventTypes(["load", "error"]);

    function handleError(message, exception) {
      logLog.error(message, exception);

      log4javascript.dispatchEvent("error", {
        message: message,
        exception: exception,
      });
    }

    log4javascript.handleError = handleError;

    /* ---------------------------------------------------------------------- */

    var enabled = !(
      typeof log4javascript_disabled != "undefined" && log4javascript_disabled
    );

    log4javascript.setEnabled = function (enable) {
      enabled = bool(enable);
    };

    log4javascript.isEnabled = function () {
      return enabled;
    };

    var useTimeStampsInMilliseconds = true;

    log4javascript.setTimeStampsInMilliseconds = function (
      timeStampsInMilliseconds
    ) {
      useTimeStampsInMilliseconds = bool(timeStampsInMilliseconds);
    };

    log4javascript.isTimeStampsInMilliseconds = function () {
      return useTimeStampsInMilliseconds;
    };

    // This evaluates the given expression in the current scope, thus allowing

    // scripts to access private variables. Particularly useful for testing

    log4javascript.evalInScope = function (expr) {
      return eval(expr);
    };

    var showStackTraces = false;

    log4javascript.setShowStackTraces = function (show) {
      showStackTraces = bool(show);
    };

    /* ---------------------------------------------------------------------- */

    // Levels

    var Level = function (level, name) {
      this.level = level;

      this.name = name;
    };

    Level.prototype = {
      toString: function () {
        return this.name;
      },

      equals: function (level) {
        return this.level == level.level;
      },

      isGreaterOrEqual: function (level) {
        return this.level >= level.level;
      },
    };

    Level.ALL = new Level(Number.MIN_VALUE, "ALL");

    Level.TRACE = new Level(10000, "TRACE");

    Level.DEBUG = new Level(20000, "DEBUG");

    Level.INFO = new Level(30000, "INFO");

    Level.WARN = new Level(40000, "WARN");

    Level.ERROR = new Level(50000, "ERROR");

    Level.FATAL = new Level(60000, "FATAL");

    Level.OFF = new Level(Number.MAX_VALUE, "OFF");

    log4javascript.Level = Level;

    /* ---------------------------------------------------------------------- */

    // Timers

    function Timer(name, level) {
      this.name = name;

      this.level = isUndefined(level) ? Level.INFO : level;

      this.start = new Date();
    }

    Timer.prototype.getElapsedTime = function () {
      return new Date().getTime() - this.start.getTime();
    };

    /* ---------------------------------------------------------------------- */

    // Loggers

    var anonymousLoggerName = "[anonymous]";

    var defaultLoggerName = "[default]";

    var nullLoggerName = "[null]";

    var rootLoggerName = "root";

    function Logger(name) {
      this.name = name;

      this.parent = null;

      this.children = [];

      var appenders = [];

      var loggerLevel = null;

      var isRoot = this.name === rootLoggerName;

      var isNull = this.name === nullLoggerName;

      var appenderCache = null;

      var appenderCacheInvalidated = false;

      this.addChild = function (childLogger) {
        this.children.push(childLogger);

        childLogger.parent = this;

        childLogger.invalidateAppenderCache();
      };

      // Additivity

      var additive = true;

      this.getAdditivity = function () {
        return additive;
      };

      this.setAdditivity = function (additivity) {
        var valueChanged = additive != additivity;

        additive = additivity;

        if (valueChanged) {
          this.invalidateAppenderCache();
        }
      };

      // Create methods that use the appenders variable in this scope

      this.addAppender = function (appender) {
        if (isNull) {
          handleError(
            "Logger.addAppender: you may not add an appender to the null logger"
          );
        } else {
          if (appender instanceof log4javascript.Appender) {
            if (!array_contains(appenders, appender)) {
              appenders.push(appender);

              appender.setAddedToLogger(this);

              this.invalidateAppenderCache();
            }
          } else {
            handleError(
              "Logger.addAppender: appender supplied ('" +
                toStr(appender) +
                "') is not a subclass of Appender"
            );
          }
        }
      };

      this.removeAppender = function (appender) {
        array_remove(appenders, appender);

        appender.setRemovedFromLogger(this);

        this.invalidateAppenderCache();
      };

      this.removeAllAppenders = function () {
        var appenderCount = appenders.length;

        if (appenderCount > 0) {
          for (var i = 0; i < appenderCount; i++) {
            appenders[i].setRemovedFromLogger(this);
          }

          appenders.length = 0;

          this.invalidateAppenderCache();
        }
      };

      this.getEffectiveAppenders = function () {
        if (appenderCache === null || appenderCacheInvalidated) {
          // Build appender cache

          var parentEffectiveAppenders =
            isRoot || !this.getAdditivity()
              ? []
              : this.parent.getEffectiveAppenders();

          appenderCache = parentEffectiveAppenders.concat(appenders);

          appenderCacheInvalidated = false;
        }

        return appenderCache;
      };

      this.invalidateAppenderCache = function () {
        appenderCacheInvalidated = true;

        for (var i = 0, len = this.children.length; i < len; i++) {
          this.children[i].invalidateAppenderCache();
        }
      };

      this.log = function (level, params) {
        if (enabled && level.isGreaterOrEqual(this.getEffectiveLevel())) {
          // Check whether last param is an exception

          var exception;

          var finalParamIndex = params.length - 1;

          var lastParam = params[finalParamIndex];

          if (params.length > 1 && isError(lastParam)) {
            exception = lastParam;

            finalParamIndex--;
          }

          // Construct genuine array for the params

          var messages = [];

          for (var i = 0; i <= finalParamIndex; i++) {
            messages[i] = params[i];
          }

          var loggingEvent = new LoggingEvent(
            this,
            new Date(),
            level,
            messages,
            exception
          );

          this.callAppenders(loggingEvent);
        }
      };

      this.callAppenders = function (loggingEvent) {
        var effectiveAppenders = this.getEffectiveAppenders();

        for (var i = 0, len = effectiveAppenders.length; i < len; i++) {
          effectiveAppenders[i].doAppend(loggingEvent);
        }
      };

      this.setLevel = function (level) {
        // Having a level of null on the root logger would be very bad.

        if (isRoot && level === null) {
          handleError(
            "Logger.setLevel: you cannot set the level of the root logger to null"
          );
        } else if (level instanceof Level) {
          loggerLevel = level;
        } else {
          handleError(
            "Logger.setLevel: level supplied to logger " +
              this.name +
              " is not an instance of log4javascript.Level"
          );
        }
      };

      this.getLevel = function () {
        return loggerLevel;
      };

      this.getEffectiveLevel = function () {
        for (var logger = this; logger !== null; logger = logger.parent) {
          var level = logger.getLevel();

          if (level !== null) {
            return level;
          }
        }
      };

      this.group = function (name, initiallyExpanded) {
        if (enabled) {
          var effectiveAppenders = this.getEffectiveAppenders();

          for (var i = 0, len = effectiveAppenders.length; i < len; i++) {
            effectiveAppenders[i].group(name, initiallyExpanded);
          }
        }
      };

      this.groupEnd = function () {
        if (enabled) {
          var effectiveAppenders = this.getEffectiveAppenders();

          for (var i = 0, len = effectiveAppenders.length; i < len; i++) {
            effectiveAppenders[i].groupEnd();
          }
        }
      };

      var timers = {};

      this.time = function (name, level) {
        if (enabled) {
          if (isUndefined(name)) {
            handleError("Logger.time: a name for the timer must be supplied");
          } else if (level && !(level instanceof Level)) {
            handleError(
              "Logger.time: level supplied to timer " +
                name +
                " is not an instance of log4javascript.Level"
            );
          } else {
            timers[name] = new Timer(name, level);
          }
        }
      };

      this.timeEnd = function (name) {
        if (enabled) {
          if (isUndefined(name)) {
            handleError(
              "Logger.timeEnd: a name for the timer must be supplied"
            );
          } else if (timers[name]) {
            var timer = timers[name];

            var milliseconds = timer.getElapsedTime();

            this.log(timer.level, [
              "Timer " + toStr(name) + " completed in " + milliseconds + "ms",
            ]);

            delete timers[name];
          } else {
            logLog.warn("Logger.timeEnd: no timer found with name " + name);
          }
        }
      };

      this.assert = function (expr) {
        if (enabled && !expr) {
          var args = [];

          for (var i = 1, len = arguments.length; i < len; i++) {
            args.push(arguments[i]);
          }

          args = args.length > 0 ? args : ["Assertion Failure"];

          args.push(newLine);

          args.push(expr);

          this.log(Level.ERROR, args);
        }
      };

      this.toString = function () {
        return "Logger[" + this.name + "]";
      };
    }

    Logger.prototype = {
      trace: function () {
        this.log(Level.TRACE, arguments);
      },

      debug: function () {
        this.log(Level.DEBUG, arguments);
      },

      info: function () {
        this.log(Level.INFO, arguments);
      },

      warn: function () {
        this.log(Level.WARN, arguments);
      },

      error: function () {
        this.log(Level.ERROR, arguments);
      },

      fatal: function () {
        this.log(Level.FATAL, arguments);
      },

      isEnabledFor: function (level) {
        return level.isGreaterOrEqual(this.getEffectiveLevel());
      },

      isTraceEnabled: function () {
        return this.isEnabledFor(Level.TRACE);
      },

      isDebugEnabled: function () {
        return this.isEnabledFor(Level.DEBUG);
      },

      isInfoEnabled: function () {
        return this.isEnabledFor(Level.INFO);
      },

      isWarnEnabled: function () {
        return this.isEnabledFor(Level.WARN);
      },

      isErrorEnabled: function () {
        return this.isEnabledFor(Level.ERROR);
      },

      isFatalEnabled: function () {
        return this.isEnabledFor(Level.FATAL);
      },
    };

    Logger.prototype.trace.isEntryPoint = true;

    Logger.prototype.debug.isEntryPoint = true;

    Logger.prototype.info.isEntryPoint = true;

    Logger.prototype.warn.isEntryPoint = true;

    Logger.prototype.error.isEntryPoint = true;

    Logger.prototype.fatal.isEntryPoint = true;

    /* ---------------------------------------------------------------------- */

    // Logger access methods

    // Hashtable of loggers keyed by logger name

    var loggers = {};

    var loggerNames = [];

    var ROOT_LOGGER_DEFAULT_LEVEL = Level.DEBUG;

    var rootLogger = new Logger(rootLoggerName);

    rootLogger.setLevel(ROOT_LOGGER_DEFAULT_LEVEL);

    log4javascript.getRootLogger = function () {
      return rootLogger;
    };

    log4javascript.getLogger = function (loggerName) {
      // Use default logger if loggerName is not specified or invalid

      if (typeof loggerName != "string") {
        loggerName = anonymousLoggerName;

        logLog.warn(
          "log4javascript.getLogger: non-string logger name " +
            toStr(loggerName) +
            " supplied, returning anonymous logger"
        );
      }

      // Do not allow retrieval of the root logger by name

      if (loggerName == rootLoggerName) {
        handleError(
          "log4javascript.getLogger: root logger may not be obtained by name"
        );
      }

      // Create the logger for this name if it doesn't already exist

      if (!loggers[loggerName]) {
        var logger = new Logger(loggerName);

        loggers[loggerName] = logger;

        loggerNames.push(loggerName);

        // Set up parent logger, if it doesn't exist

        var lastDotIndex = loggerName.lastIndexOf(".");

        var parentLogger;

        if (lastDotIndex > -1) {
          var parentLoggerName = loggerName.substring(0, lastDotIndex);

          parentLogger = log4javascript.getLogger(parentLoggerName); // Recursively sets up grandparents etc.
        } else {
          parentLogger = rootLogger;
        }

        parentLogger.addChild(logger);
      }

      return loggers[loggerName];
    };

    var defaultLogger = null;

    log4javascript.getDefaultLogger = function () {
      if (!defaultLogger) {
        defaultLogger = createDefaultLogger();
      }

      return defaultLogger;
    };

    var nullLogger = null;

    log4javascript.getNullLogger = function () {
      if (!nullLogger) {
        nullLogger = new Logger(nullLoggerName);

        nullLogger.setLevel(Level.OFF);
      }

      return nullLogger;
    };

    // Destroys all loggers

    log4javascript.resetConfiguration = function () {
      rootLogger.setLevel(ROOT_LOGGER_DEFAULT_LEVEL);

      loggers = {};
    };

    /* ---------------------------------------------------------------------- */

    // Logging events

    var LoggingEvent = function (
      logger,
      timeStamp,
      level,
      messages,

      exception
    ) {
      this.logger = logger;

      this.timeStamp = timeStamp;

      this.timeStampInMilliseconds = timeStamp.getTime();

      this.timeStampInSeconds = Math.floor(this.timeStampInMilliseconds / 1000);

      this.milliseconds = this.timeStamp.getMilliseconds();

      this.level = level;

      this.messages = messages;

      this.exception = exception;
    };

    LoggingEvent.prototype = {
      getThrowableStrRep: function () {
        return this.exception ? getExceptionStringRep(this.exception) : "";
      },

      getCombinedMessages: function () {
        return this.messages.length == 1
          ? this.messages[0]
          : this.messages.join(newLine);
      },

      toString: function () {
        return "LoggingEvent[" + this.level + "]";
      },
    };

    log4javascript.LoggingEvent = LoggingEvent;

    /* ---------------------------------------------------------------------- */

    // Layout prototype

    var Layout = function () {};

    Layout.prototype = {
      defaults: {
        loggerKey: "logger",

        timeStampKey: "timestamp",

        millisecondsKey: "milliseconds",

        levelKey: "level",

        messageKey: "message",

        exceptionKey: "exception",

        urlKey: "url",
      },

      loggerKey: "logger",

      timeStampKey: "timestamp",

      millisecondsKey: "milliseconds",

      levelKey: "level",

      messageKey: "message",

      exceptionKey: "exception",

      urlKey: "url",

      batchHeader: "",

      batchFooter: "",

      batchSeparator: "",

      returnsPostData: false,

      overrideTimeStampsSetting: false,

      useTimeStampsInMilliseconds: null,

      format: function () {
        handleError("Layout.format: layout supplied has no format() method");
      },

      ignoresThrowable: function () {
        handleError(
          "Layout.ignoresThrowable: layout supplied has no ignoresThrowable() method"
        );
      },

      getContentType: function () {
        return "text/plain";
      },

      allowBatching: function () {
        return true;
      },

      setTimeStampsInMilliseconds: function (timeStampsInMilliseconds) {
        this.overrideTimeStampsSetting = true;

        this.useTimeStampsInMilliseconds = bool(timeStampsInMilliseconds);
      },

      isTimeStampsInMilliseconds: function () {
        return this.overrideTimeStampsSetting
          ? this.useTimeStampsInMilliseconds
          : useTimeStampsInMilliseconds;
      },

      getTimeStampValue: function (loggingEvent) {
        return this.isTimeStampsInMilliseconds()
          ? loggingEvent.timeStampInMilliseconds
          : loggingEvent.timeStampInSeconds;
      },

      getDataValues: function (loggingEvent, combineMessages) {
        var dataValues = [
          [this.loggerKey, loggingEvent.logger.name],

          [this.timeStampKey, this.getTimeStampValue(loggingEvent)],

          [this.levelKey, loggingEvent.level.name],

          [this.urlKey, window.location.href],

          [
            this.messageKey,
            combineMessages
              ? loggingEvent.getCombinedMessages()
              : loggingEvent.messages,
          ],
        ];

        if (!this.isTimeStampsInMilliseconds()) {
          dataValues.push([this.millisecondsKey, loggingEvent.milliseconds]);
        }

        if (loggingEvent.exception) {
          dataValues.push([
            this.exceptionKey,
            getExceptionStringRep(loggingEvent.exception),
          ]);
        }

        if (this.hasCustomFields()) {
          for (var i = 0, len = this.customFields.length; i < len; i++) {
            var val = this.customFields[i].value;

            // Check if the value is a function. If so, execute it, passing it the

            // current layout and the logging event

            if (typeof val === "function") {
              val = val(this, loggingEvent);
            }

            dataValues.push([this.customFields[i].name, val]);
          }
        }

        return dataValues;
      },

      setKeys: function (
        loggerKey,
        timeStampKey,
        levelKey,
        messageKey,

        exceptionKey,
        urlKey,
        millisecondsKey
      ) {
        this.loggerKey = extractStringFromParam(
          loggerKey,
          this.defaults.loggerKey
        );

        this.timeStampKey = extractStringFromParam(
          timeStampKey,
          this.defaults.timeStampKey
        );

        this.levelKey = extractStringFromParam(
          levelKey,
          this.defaults.levelKey
        );

        this.messageKey = extractStringFromParam(
          messageKey,
          this.defaults.messageKey
        );

        this.exceptionKey = extractStringFromParam(
          exceptionKey,
          this.defaults.exceptionKey
        );

        this.urlKey = extractStringFromParam(urlKey, this.defaults.urlKey);

        this.millisecondsKey = extractStringFromParam(
          millisecondsKey,
          this.defaults.millisecondsKey
        );
      },

      setCustomField: function (name, value) {
        var fieldUpdated = false;

        for (var i = 0, len = this.customFields.length; i < len; i++) {
          if (this.customFields[i].name === name) {
            this.customFields[i].value = value;

            fieldUpdated = true;
          }
        }

        if (!fieldUpdated) {
          this.customFields.push({ name: name, value: value });
        }
      },

      hasCustomFields: function () {
        return this.customFields.length > 0;
      },

      formatWithException: function (loggingEvent) {
        var formatted = this.format(loggingEvent);

        if (loggingEvent.exception && this.ignoresThrowable()) {
          formatted += loggingEvent.getThrowableStrRep();
        }

        return formatted;
      },

      toString: function () {
        handleError("Layout.toString: all layouts must override this method");
      },
    };

    log4javascript.Layout = Layout;

    /* ---------------------------------------------------------------------- */

    // Appender prototype

    var Appender = function () {};

    Appender.prototype = new EventSupport();

    Appender.prototype.layout = new PatternLayout();

    Appender.prototype.threshold = Level.ALL;

    Appender.prototype.loggers = [];

    // Performs threshold checks before delegating actual logging to the

    // subclass's specific append method.

    Appender.prototype.doAppend = function (loggingEvent) {
      if (enabled && loggingEvent.level.level >= this.threshold.level) {
        this.append(loggingEvent);
      }
    };

    Appender.prototype.append = function (loggingEvent) {};

    Appender.prototype.setLayout = function (layout) {
      if (layout instanceof Layout) {
        this.layout = layout;
      } else {
        handleError(
          "Appender.setLayout: layout supplied to " +
            this.toString() +
            " is not a subclass of Layout"
        );
      }
    };

    Appender.prototype.getLayout = function () {
      return this.layout;
    };

    Appender.prototype.setThreshold = function (threshold) {
      if (threshold instanceof Level) {
        this.threshold = threshold;
      } else {
        handleError(
          "Appender.setThreshold: threshold supplied to " +
            this.toString() +
            " is not a subclass of Level"
        );
      }
    };

    Appender.prototype.getThreshold = function () {
      return this.threshold;
    };

    Appender.prototype.setAddedToLogger = function (logger) {
      this.loggers.push(logger);
    };

    Appender.prototype.setRemovedFromLogger = function (logger) {
      array_remove(this.loggers, logger);
    };

    Appender.prototype.group = emptyFunction;

    Appender.prototype.groupEnd = emptyFunction;

    Appender.prototype.toString = function () {
      handleError("Appender.toString: all appenders must override this method");
    };

    log4javascript.Appender = Appender;

    /* ---------------------------------------------------------------------- */

    // SimpleLayout

    function SimpleLayout() {
      this.customFields = [];
    }

    SimpleLayout.prototype = new Layout();

    SimpleLayout.prototype.format = function (loggingEvent) {
      return (
        loggingEvent.level.name + " - " + loggingEvent.getCombinedMessages()
      );
    };

    SimpleLayout.prototype.ignoresThrowable = function () {
      return true;
    };

    SimpleLayout.prototype.toString = function () {
      return "SimpleLayout";
    };

    log4javascript.SimpleLayout = SimpleLayout;

    /* ----------------------------------------------------------------------- */

    // NullLayout

    function NullLayout() {
      this.customFields = [];
    }

    NullLayout.prototype = new Layout();

    NullLayout.prototype.format = function (loggingEvent) {
      return loggingEvent.messages;
    };

    NullLayout.prototype.ignoresThrowable = function () {
      return true;
    };

    NullLayout.prototype.formatWithException = function (loggingEvent) {
      var messages = loggingEvent.messages,
        ex = loggingEvent.exception;

      return ex ? messages.concat([ex]) : messages;
    };

    NullLayout.prototype.toString = function () {
      return "NullLayout";
    };

    log4javascript.NullLayout = NullLayout;

    /* ---------------------------------------------------------------------- */

    // XmlLayout

    function XmlLayout(combineMessages) {
      this.combineMessages = extractBooleanFromParam(combineMessages, true);

      this.customFields = [];
    }

    XmlLayout.prototype = new Layout();

    XmlLayout.prototype.isCombinedMessages = function () {
      return this.combineMessages;
    };

    XmlLayout.prototype.getContentType = function () {
      return "text/xml";
    };

    XmlLayout.prototype.escapeCdata = function (str) {
      return str.replace(/\]\]>/, "]]>]]&gt;<![CDATA[");
    };

    XmlLayout.prototype.format = function (loggingEvent) {
      var layout = this;

      var i, len;

      function formatMessage(message) {
        message = typeof message === "string" ? message : toStr(message);

        return (
          "<log4javascript:message><![CDATA[" +
          layout.escapeCdata(message) +
          "]]></log4javascript:message>"
        );
      }

      var str =
        '<log4javascript:event logger="' +
        loggingEvent.logger.name +
        '" timestamp="' +
        this.getTimeStampValue(loggingEvent) +
        '"';

      if (!this.isTimeStampsInMilliseconds()) {
        str += ' milliseconds="' + loggingEvent.milliseconds + '"';
      }

      str += ' level="' + loggingEvent.level.name + '">' + newLine;

      if (this.combineMessages) {
        str += formatMessage(loggingEvent.getCombinedMessages());
      } else {
        str += "<log4javascript:messages>" + newLine;

        for (i = 0, len = loggingEvent.messages.length; i < len; i++) {
          str += formatMessage(loggingEvent.messages[i]) + newLine;
        }

        str += "</log4javascript:messages>" + newLine;
      }

      if (this.hasCustomFields()) {
        for (i = 0, len = this.customFields.length; i < len; i++) {
          str +=
            '<log4javascript:customfield name="' +
            this.customFields[i].name +
            '"><![CDATA[' +
            this.customFields[i].value.toString() +
            "]]></log4javascript:customfield>" +
            newLine;
        }
      }

      if (loggingEvent.exception) {
        str +=
          "<log4javascript:exception><![CDATA[" +
          getExceptionStringRep(loggingEvent.exception) +
          "]]></log4javascript:exception>" +
          newLine;
      }

      str += "</log4javascript:event>" + newLine + newLine;

      return str;
    };

    XmlLayout.prototype.ignoresThrowable = function () {
      return false;
    };

    XmlLayout.prototype.toString = function () {
      return "XmlLayout";
    };

    log4javascript.XmlLayout = XmlLayout;

    /* ---------------------------------------------------------------------- */

    // JsonLayout related

    function escapeNewLines(str) {
      return str.replace(/\r\n|\r|\n/g, "\\r\\n");
    }

    function JsonLayout(readable, combineMessages) {
      this.readable = extractBooleanFromParam(readable, false);

      this.combineMessages = extractBooleanFromParam(combineMessages, true);

      this.batchHeader = this.readable ? "[" + newLine : "[";

      this.batchFooter = this.readable ? "]" + newLine : "]";

      this.batchSeparator = this.readable ? "," + newLine : ",";

      this.setKeys();

      this.colon = this.readable ? ": " : ":";

      this.tab = this.readable ? "\t" : "";

      this.lineBreak = this.readable ? newLine : "";

      this.customFields = [];
    }

    /* ---------------------------------------------------------------------- */

    // JsonLayout

    JsonLayout.prototype = new Layout();

    JsonLayout.prototype.isReadable = function () {
      return this.readable;
    };

    JsonLayout.prototype.isCombinedMessages = function () {
      return this.combineMessages;
    };

    JsonLayout.prototype.format = function (loggingEvent) {
      var layout = this;

      var dataValues = this.getDataValues(loggingEvent, this.combineMessages);

      var str = "{" + this.lineBreak;

      var i, len;

      function formatValue(val, prefix, expand) {
        // Check the type of the data value to decide whether quotation marks

        // or expansion are required

        var formattedValue;

        var valType = typeof val;

        if (val instanceof Date) {
          formattedValue = String(val.getTime());
        } else if (expand && val instanceof Array) {
          formattedValue = "[" + layout.lineBreak;

          for (var i = 0, len = val.length; i < len; i++) {
            var childPrefix = prefix + layout.tab;

            formattedValue +=
              childPrefix + formatValue(val[i], childPrefix, false);

            if (i < val.length - 1) {
              formattedValue += ",";
            }

            formattedValue += layout.lineBreak;
          }

          formattedValue += prefix + "]";
        } else if (valType !== "number" && valType !== "boolean") {
          formattedValue =
            '"' + escapeNewLines(toStr(val).replace(/\"/g, '\\"')) + '"';
        } else {
          formattedValue = val;
        }

        return formattedValue;
      }

      for (i = 0, len = dataValues.length - 1; i <= len; i++) {
        str +=
          this.tab +
          '"' +
          dataValues[i][0] +
          '"' +
          this.colon +
          formatValue(dataValues[i][1], this.tab, true);

        if (i < len) {
          str += ",";
        }

        str += this.lineBreak;
      }

      str += "}" + this.lineBreak;

      return str;
    };

    JsonLayout.prototype.ignoresThrowable = function () {
      return false;
    };

    JsonLayout.prototype.toString = function () {
      return "JsonLayout";
    };

    JsonLayout.prototype.getContentType = function () {
      return "application/json";
    };

    log4javascript.JsonLayout = JsonLayout;

    /* ---------------------------------------------------------------------- */

    // HttpPostDataLayout

    function HttpPostDataLayout() {
      this.setKeys();

      this.customFields = [];

      this.returnsPostData = true;
    }

    HttpPostDataLayout.prototype = new Layout();

    // Disable batching

    HttpPostDataLayout.prototype.allowBatching = function () {
      return false;
    };

    HttpPostDataLayout.prototype.format = function (loggingEvent) {
      var dataValues = this.getDataValues(loggingEvent);

      var queryBits = [];

      for (var i = 0, len = dataValues.length; i < len; i++) {
        var val =
          dataValues[i][1] instanceof Date
            ? String(dataValues[i][1].getTime())
            : dataValues[i][1];

        queryBits.push(urlEncode(dataValues[i][0]) + "=" + urlEncode(val));
      }

      return queryBits.join("&");
    };

    HttpPostDataLayout.prototype.ignoresThrowable = function (loggingEvent) {
      return false;
    };

    HttpPostDataLayout.prototype.toString = function () {
      return "HttpPostDataLayout";
    };

    log4javascript.HttpPostDataLayout = HttpPostDataLayout;

    /* ---------------------------------------------------------------------- */

    // formatObjectExpansion

    function formatObjectExpansion(obj, depth, indentation) {
      var objectsExpanded = [];

      function doFormat(obj, depth, indentation) {
        var i,
          len,
          childDepth,
          childIndentation,
          childLines,
          expansion,
          childExpansion;

        if (!indentation) {
          indentation = "";
        }

        function formatString(text) {
          var lines = splitIntoLines(text);

          for (var j = 1, jLen = lines.length; j < jLen; j++) {
            lines[j] = indentation + lines[j];
          }

          return lines.join(newLine);
        }

        if (obj === null) {
          return "null";
        } else if (typeof obj == "undefined") {
          return "undefined";
        } else if (typeof obj == "string") {
          return formatString(obj);
        } else if (
          typeof obj == "object" &&
          array_contains(objectsExpanded, obj)
        ) {
          try {
            expansion = toStr(obj);
          } catch (ex) {
            expansion =
              "Error formatting property. Details: " +
              getExceptionStringRep(ex);
          }

          return expansion + " [already expanded]";
        } else if (obj instanceof Array && depth > 0) {
          objectsExpanded.push(obj);

          expansion = "[" + newLine;

          childDepth = depth - 1;

          childIndentation = indentation + "  ";

          childLines = [];

          for (i = 0, len = obj.length; i < len; i++) {
            try {
              childExpansion = doFormat(obj[i], childDepth, childIndentation);

              childLines.push(childIndentation + childExpansion);
            } catch (ex) {
              childLines.push(
                childIndentation +
                  "Error formatting array member. Details: " +
                  getExceptionStringRep(ex) +
                  ""
              );
            }
          }

          expansion +=
            childLines.join("," + newLine) + newLine + indentation + "]";

          return expansion;
        } else if (Object.prototype.toString.call(obj) == "[object Date]") {
          return obj.toString();
        } else if (typeof obj == "object" && depth > 0) {
          objectsExpanded.push(obj);

          expansion = "{" + newLine;

          childDepth = depth - 1;

          childIndentation = indentation + "  ";

          childLines = [];

          for (i in obj) {
            try {
              childExpansion = doFormat(obj[i], childDepth, childIndentation);

              childLines.push(childIndentation + i + ": " + childExpansion);
            } catch (ex) {
              childLines.push(
                childIndentation +
                  i +
                  ": Error formatting property. Details: " +
                  getExceptionStringRep(ex)
              );
            }
          }

          expansion +=
            childLines.join("," + newLine) + newLine + indentation + "}";

          return expansion;
        } else {
          return formatString(toStr(obj));
        }
      }

      return doFormat(obj, depth, indentation);
    }

    /* ---------------------------------------------------------------------- */

    // Date-related stuff

    var SimpleDateFormat;

    (function () {
      var regex =
        /('[^']*')|(G+|y+|M+|w+|W+|D+|d+|F+|E+|a+|H+|k+|K+|h+|m+|s+|S+|Z+)|([a-zA-Z]+)|([^a-zA-Z']+)/;

      var monthNames = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",

        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ];

      var dayNames = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ];

      var TEXT2 = 0,
        TEXT3 = 1,
        NUMBER = 2,
        YEAR = 3,
        MONTH = 4,
        TIMEZONE = 5;

      var types = {
        G: TEXT2,

        y: YEAR,

        M: MONTH,

        w: NUMBER,

        W: NUMBER,

        D: NUMBER,

        d: NUMBER,

        F: NUMBER,

        E: TEXT3,

        a: TEXT2,

        H: NUMBER,

        k: NUMBER,

        K: NUMBER,

        h: NUMBER,

        m: NUMBER,

        s: NUMBER,

        S: NUMBER,

        Z: TIMEZONE,
      };

      var ONE_DAY = 24 * 60 * 60 * 1000;

      var ONE_WEEK = 7 * ONE_DAY;

      var DEFAULT_MINIMAL_DAYS_IN_FIRST_WEEK = 1;

      var newDateAtMidnight = function (year, month, day) {
        var d = new Date(year, month, day, 0, 0, 0);

        d.setMilliseconds(0);

        return d;
      };

      Date.prototype.getDifference = function (date) {
        return this.getTime() - date.getTime();
      };

      Date.prototype.isBefore = function (d) {
        return this.getTime() < d.getTime();
      };

      Date.prototype.getUTCTime = function () {
        return Date.UTC(
          this.getFullYear(),
          this.getMonth(),
          this.getDate(),
          this.getHours(),
          this.getMinutes(),

          this.getSeconds(),
          this.getMilliseconds()
        );
      };

      Date.prototype.getTimeSince = function (d) {
        return this.getUTCTime() - d.getUTCTime();
      };

      Date.prototype.getPreviousSunday = function () {
        // Using midday avoids any possibility of DST messing things up

        var midday = new Date(
          this.getFullYear(),
          this.getMonth(),
          this.getDate(),
          12,
          0,
          0
        );

        var previousSunday = new Date(
          midday.getTime() - this.getDay() * ONE_DAY
        );

        return newDateAtMidnight(
          previousSunday.getFullYear(),
          previousSunday.getMonth(),

          previousSunday.getDate()
        );
      };

      Date.prototype.getWeekInYear = function (minimalDaysInFirstWeek) {
        if (isUndefined(this.minimalDaysInFirstWeek)) {
          minimalDaysInFirstWeek = DEFAULT_MINIMAL_DAYS_IN_FIRST_WEEK;
        }

        var previousSunday = this.getPreviousSunday();

        var startOfYear = newDateAtMidnight(this.getFullYear(), 0, 1);

        var numberOfSundays = previousSunday.isBefore(startOfYear)
          ? 0
          : 1 + Math.floor(previousSunday.getTimeSince(startOfYear) / ONE_WEEK);

        var numberOfDaysInFirstWeek = 7 - startOfYear.getDay();

        var weekInYear = numberOfSundays;

        if (numberOfDaysInFirstWeek < minimalDaysInFirstWeek) {
          weekInYear--;
        }

        return weekInYear;
      };

      Date.prototype.getWeekInMonth = function (minimalDaysInFirstWeek) {
        if (isUndefined(this.minimalDaysInFirstWeek)) {
          minimalDaysInFirstWeek = DEFAULT_MINIMAL_DAYS_IN_FIRST_WEEK;
        }

        var previousSunday = this.getPreviousSunday();

        var startOfMonth = newDateAtMidnight(
          this.getFullYear(),
          this.getMonth(),
          1
        );

        var numberOfSundays = previousSunday.isBefore(startOfMonth)
          ? 0
          : 1 +
            Math.floor(previousSunday.getTimeSince(startOfMonth) / ONE_WEEK);

        var numberOfDaysInFirstWeek = 7 - startOfMonth.getDay();

        var weekInMonth = numberOfSundays;

        if (numberOfDaysInFirstWeek >= minimalDaysInFirstWeek) {
          weekInMonth++;
        }

        return weekInMonth;
      };

      Date.prototype.getDayInYear = function () {
        var startOfYear = newDateAtMidnight(this.getFullYear(), 0, 1);

        return 1 + Math.floor(this.getTimeSince(startOfYear) / ONE_DAY);
      };

      /* ------------------------------------------------------------------ */

      SimpleDateFormat = function (formatString) {
        this.formatString = formatString;
      };

      /**

		 * Sets the minimum number of days in a week in order for that week to

		 * be considered as belonging to a particular month or year

		 */

      SimpleDateFormat.prototype.setMinimalDaysInFirstWeek = function (days) {
        this.minimalDaysInFirstWeek = days;
      };

      SimpleDateFormat.prototype.getMinimalDaysInFirstWeek = function () {
        return isUndefined(this.minimalDaysInFirstWeek)
          ? DEFAULT_MINIMAL_DAYS_IN_FIRST_WEEK
          : this.minimalDaysInFirstWeek;
      };

      var padWithZeroes = function (str, len) {
        while (str.length < len) {
          str = "0" + str;
        }

        return str;
      };

      var formatText = function (data, numberOfLetters, minLength) {
        return numberOfLetters >= 4
          ? data
          : data.substr(0, Math.max(minLength, numberOfLetters));
      };

      var formatNumber = function (data, numberOfLetters) {
        var dataString = "" + data;

        // Pad with 0s as necessary

        return padWithZeroes(dataString, numberOfLetters);
      };

      SimpleDateFormat.prototype.format = function (date) {
        var formattedString = "";

        var result;

        var searchString = this.formatString;

        while ((result = regex.exec(searchString))) {
          var quotedString = result[1];

          var patternLetters = result[2];

          var otherLetters = result[3];

          var otherCharacters = result[4];

          // If the pattern matched is quoted string, output the text between the quotes

          if (quotedString) {
            if (quotedString == "''") {
              formattedString += "'";
            } else {
              formattedString += quotedString.substring(
                1,
                quotedString.length - 1
              );
            }
          } else if (otherLetters) {
            // Swallow non-pattern letters by doing nothing here
          } else if (otherCharacters) {
            // Simply output other characters

            formattedString += otherCharacters;
          } else if (patternLetters) {
            // Replace pattern letters

            var patternLetter = patternLetters.charAt(0);

            var numberOfLetters = patternLetters.length;

            var rawData = "";

            switch (patternLetter) {
              case "G":
                rawData = "AD";

                break;

              case "y":
                rawData = date.getFullYear();

                break;

              case "M":
                rawData = date.getMonth();

                break;

              case "w":
                rawData = date.getWeekInYear(this.getMinimalDaysInFirstWeek());

                break;

              case "W":
                rawData = date.getWeekInMonth(this.getMinimalDaysInFirstWeek());

                break;

              case "D":
                rawData = date.getDayInYear();

                break;

              case "d":
                rawData = date.getDate();

                break;

              case "F":
                rawData = 1 + Math.floor((date.getDate() - 1) / 7);

                break;

              case "E":
                rawData = dayNames[date.getDay()];

                break;

              case "a":
                rawData = date.getHours() >= 12 ? "PM" : "AM";

                break;

              case "H":
                rawData = date.getHours();

                break;

              case "k":
                rawData = date.getHours() || 24;

                break;

              case "K":
                rawData = date.getHours() % 12;

                break;

              case "h":
                rawData = date.getHours() % 12 || 12;

                break;

              case "m":
                rawData = date.getMinutes();

                break;

              case "s":
                rawData = date.getSeconds();

                break;

              case "S":
                rawData = date.getMilliseconds();

                break;

              case "Z":
                rawData = date.getTimezoneOffset(); // This returns the number of minutes since GMT was this time.

                break;
            }

            // Format the raw data depending on the type

            switch (types[patternLetter]) {
              case TEXT2:
                formattedString += formatText(rawData, numberOfLetters, 2);

                break;

              case TEXT3:
                formattedString += formatText(rawData, numberOfLetters, 3);

                break;

              case NUMBER:
                formattedString += formatNumber(rawData, numberOfLetters);

                break;

              case YEAR:
                if (numberOfLetters <= 3) {
                  // Output a 2-digit year

                  var dataString = "" + rawData;

                  formattedString += dataString.substr(2, 2);
                } else {
                  formattedString += formatNumber(rawData, numberOfLetters);
                }

                break;

              case MONTH:
                if (numberOfLetters >= 3) {
                  formattedString += formatText(
                    monthNames[rawData],
                    numberOfLetters,
                    numberOfLetters
                  );
                } else {
                  // NB. Months returned by getMonth are zero-based

                  formattedString += formatNumber(rawData + 1, numberOfLetters);
                }

                break;

              case TIMEZONE:
                var isPositive = rawData > 0;

                // The following line looks like a mistake but isn't

                // because of the way getTimezoneOffset measures.

                var prefix = isPositive ? "-" : "+";

                var absData = Math.abs(rawData);

                // Hours

                var hours = "" + Math.floor(absData / 60);

                hours = padWithZeroes(hours, 2);

                // Minutes

                var minutes = "" + (absData % 60);

                minutes = padWithZeroes(minutes, 2);

                formattedString += prefix + hours + minutes;

                break;
            }
          }

          searchString = searchString.substr(result.index + result[0].length);
        }

        return formattedString;
      };
    })();

    log4javascript.SimpleDateFormat = SimpleDateFormat;

    /* ---------------------------------------------------------------------- */

    // PatternLayout

    function PatternLayout(pattern) {
      if (pattern) {
        this.pattern = pattern;
      } else {
        this.pattern = PatternLayout.DEFAULT_CONVERSION_PATTERN;
      }

      this.customFields = [];
    }

    PatternLayout.TTCC_CONVERSION_PATTERN = "%r %p %c - %m%n";

    PatternLayout.DEFAULT_CONVERSION_PATTERN = "%m%n";

    PatternLayout.ISO8601_DATEFORMAT = "yyyy-MM-dd HH:mm:ss,SSS";

    PatternLayout.DATETIME_DATEFORMAT = "dd MMM yyyy HH:mm:ss,SSS";

    PatternLayout.ABSOLUTETIME_DATEFORMAT = "HH:mm:ss,SSS";

    PatternLayout.prototype = new Layout();

    PatternLayout.prototype.format = function (loggingEvent) {
      var regex =
        /%(-?[0-9]+)?(\.?[0-9]+)?([acdfmMnpr%])(\{([^\}]+)\})?|([^%]+)/;

      var formattedString = "";

      var result;

      var searchString = this.pattern;

      // Cannot use regex global flag since it doesn't work with exec in IE5

      while ((result = regex.exec(searchString))) {
        var matchedString = result[0];

        var padding = result[1];

        var truncation = result[2];

        var conversionCharacter = result[3];

        var specifier = result[5];

        var text = result[6];

        // Check if the pattern matched was just normal text

        if (text) {
          formattedString += "" + text;
        } else {
          // Create a raw replacement string based on the conversion

          // character and specifier

          var replacement = "";

          switch (conversionCharacter) {
            case "a": // Array of messages

            case "m": // Message
              var depth = 0;

              if (specifier) {
                depth = parseInt(specifier, 10);

                if (isNaN(depth)) {
                  handleError(
                    "PatternLayout.format: invalid specifier '" +
                      specifier +
                      "' for conversion character '" +
                      conversionCharacter +
                      "' - should be a number"
                  );

                  depth = 0;
                }
              }

              var messages =
                conversionCharacter === "a"
                  ? loggingEvent.messages[0]
                  : loggingEvent.messages;

              for (var i = 0, len = messages.length; i < len; i++) {
                if (
                  i > 0 &&
                  replacement.charAt(replacement.length - 1) !== " "
                ) {
                  replacement += " ";
                }

                if (depth === 0) {
                  replacement += messages[i];
                } else {
                  replacement += formatObjectExpansion(messages[i], depth);
                }
              }

              break;

            case "c": // Logger name
              var loggerName = loggingEvent.logger.name;

              if (specifier) {
                var precision = parseInt(specifier, 10);

                var loggerNameBits = loggingEvent.logger.name.split(".");

                if (precision >= loggerNameBits.length) {
                  replacement = loggerName;
                } else {
                  replacement = loggerNameBits
                    .slice(loggerNameBits.length - precision)
                    .join(".");
                }
              } else {
                replacement = loggerName;
              }

              break;

            case "d": // Date
              var dateFormat = PatternLayout.ISO8601_DATEFORMAT;

              if (specifier) {
                dateFormat = specifier;

                // Pick up special cases

                if (dateFormat == "ISO8601") {
                  dateFormat = PatternLayout.ISO8601_DATEFORMAT;
                } else if (dateFormat == "ABSOLUTE") {
                  dateFormat = PatternLayout.ABSOLUTETIME_DATEFORMAT;
                } else if (dateFormat == "DATE") {
                  dateFormat = PatternLayout.DATETIME_DATEFORMAT;
                }
              }

              // Format the date

              replacement = new SimpleDateFormat(dateFormat).format(
                loggingEvent.timeStamp
              );

              break;

            case "f": // Custom field
              if (this.hasCustomFields()) {
                var fieldIndex = 0;

                if (specifier) {
                  fieldIndex = parseInt(specifier, 10);

                  if (isNaN(fieldIndex)) {
                    handleError(
                      "PatternLayout.format: invalid specifier '" +
                        specifier +
                        "' for conversion character 'f' - should be a number"
                    );
                  } else if (fieldIndex === 0) {
                    handleError(
                      "PatternLayout.format: invalid specifier '" +
                        specifier +
                        "' for conversion character 'f' - must be greater than zero"
                    );
                  } else if (fieldIndex > this.customFields.length) {
                    handleError(
                      "PatternLayout.format: invalid specifier '" +
                        specifier +
                        "' for conversion character 'f' - there aren't that many custom fields"
                    );
                  } else {
                    fieldIndex = fieldIndex - 1;
                  }
                }

                var val = this.customFields[fieldIndex].value;

                if (typeof val == "function") {
                  val = val(this, loggingEvent);
                }

                replacement = val;
              }

              break;

            case "n": // New line
              replacement = newLine;

              break;

            case "p": // Level
              replacement = loggingEvent.level.name;

              break;

            case "r": // Milliseconds since log4javascript startup
              replacement =
                "" + loggingEvent.timeStamp.getDifference(applicationStartDate);

              break;

            case "%": // Literal % sign
              replacement = "%";

              break;

            default:
              replacement = matchedString;

              break;
          }

          // Format the replacement according to any padding or

          // truncation specified

          var l;

          // First, truncation

          if (truncation) {
            l = parseInt(truncation.substr(1), 10);

            var strLen = replacement.length;

            if (l < strLen) {
              replacement = replacement.substring(strLen - l, strLen);
            }
          }

          // Next, padding

          if (padding) {
            if (padding.charAt(0) == "-") {
              l = parseInt(padding.substr(1), 10);

              // Right pad with spaces

              while (replacement.length < l) {
                replacement += " ";
              }
            } else {
              l = parseInt(padding, 10);

              // Left pad with spaces

              while (replacement.length < l) {
                replacement = " " + replacement;
              }
            }
          }

          formattedString += replacement;
        }

        searchString = searchString.substr(result.index + result[0].length);
      }

      return formattedString;
    };

    PatternLayout.prototype.ignoresThrowable = function () {
      return true;
    };

    PatternLayout.prototype.toString = function () {
      return "PatternLayout";
    };

    log4javascript.PatternLayout = PatternLayout;

    /* ---------------------------------------------------------------------- */

    // AlertAppender

    function AlertAppender() {}

    AlertAppender.prototype = new Appender();

    AlertAppender.prototype.layout = new SimpleLayout();

    AlertAppender.prototype.append = function (loggingEvent) {
      alert(this.getLayout().formatWithException(loggingEvent));
    };

    AlertAppender.prototype.toString = function () {
      return "AlertAppender";
    };

    log4javascript.AlertAppender = AlertAppender;

    /* ---------------------------------------------------------------------- */

    // BrowserConsoleAppender (only works in Opera and Safari and Firefox with

    // Firebug extension)

    function BrowserConsoleAppender() {}

    BrowserConsoleAppender.prototype = new log4javascript.Appender();

    BrowserConsoleAppender.prototype.layout = new NullLayout();

    BrowserConsoleAppender.prototype.threshold = Level.DEBUG;

    BrowserConsoleAppender.prototype.append = function (loggingEvent) {
      var appender = this;

      var getFormattedMessage = function (concatenate) {
        var formattedMessage = appender
          .getLayout()
          .formatWithException(loggingEvent);

        return typeof formattedMessage == "string"
          ? concatenate
            ? formattedMessage
            : [formattedMessage]
          : concatenate
          ? formattedMessage.join(" ")
          : formattedMessage;
      };

      var console = window.console;

      if (console && console.log) {
        // Log to Firebug or the browser console using specific logging

        // methods or revert to console.log otherwise

        var consoleMethodName;

        if (console.debug && Level.DEBUG.isGreaterOrEqual(loggingEvent.level)) {
          consoleMethodName = "debug";
        } else if (console.info && Level.INFO.equals(loggingEvent.level)) {
          consoleMethodName = "info";
        } else if (console.warn && Level.WARN.equals(loggingEvent.level)) {
          consoleMethodName = "warn";
        } else if (
          console.error &&
          loggingEvent.level.isGreaterOrEqual(Level.ERROR)
        ) {
          consoleMethodName = "error";
        } else {
          consoleMethodName = "log";
        }

        if (typeof console[consoleMethodName].apply == "function") {
          console[consoleMethodName].apply(console, getFormattedMessage(false));
        } else {
          console[consoleMethodName](getFormattedMessage(true));
        }
      } else if (typeof opera != "undefined" && opera.postError) {
        // Opera

        opera.postError(getFormattedMessage(true));
      }
    };

    BrowserConsoleAppender.prototype.group = function (name) {
      if (window.console && window.console.group) {
        window.console.group(name);
      }
    };

    BrowserConsoleAppender.prototype.groupEnd = function () {
      if (window.console && window.console.groupEnd) {
        window.console.groupEnd();
      }
    };

    BrowserConsoleAppender.prototype.toString = function () {
      return "BrowserConsoleAppender";
    };

    log4javascript.BrowserConsoleAppender = BrowserConsoleAppender;

    /* ---------------------------------------------------------------------- */

    // AjaxAppender related

    var xhrFactory = function () {
      return new XMLHttpRequest();
    };

    var xmlHttpFactories = [
      xhrFactory,

      function () {
        return new ActiveXObject("Msxml2.XMLHTTP");
      },

      function () {
        return new ActiveXObject("Microsoft.XMLHTTP");
      },
    ];

    var withCredentialsSupported = false;

    var getXmlHttp = function (errorHandler) {
      // This is only run the first time; the value of getXmlHttp gets

      // replaced with the factory that succeeds on the first run

      var xmlHttp = null,
        factory;

      for (var i = 0, len = xmlHttpFactories.length; i < len; i++) {
        factory = xmlHttpFactories[i];

        try {
          xmlHttp = factory();

          withCredentialsSupported =
            factory == xhrFactory && "withCredentials" in xmlHttp;

          getXmlHttp = factory;

          return xmlHttp;
        } catch (e) {}
      }

      // If we're here, all factories have failed, so throw an error

      if (errorHandler) {
        errorHandler();
      } else {
        handleError("getXmlHttp: unable to obtain XMLHttpRequest object");
      }
    };

    function isHttpRequestSuccessful(xmlHttp) {
      return (
        isUndefined(xmlHttp.status) ||
        xmlHttp.status === 0 ||
        (xmlHttp.status >= 200 && xmlHttp.status < 300) ||
        xmlHttp.status == 1223 /* Fix for IE */
      );
    }

    /* ---------------------------------------------------------------------- */

    // AjaxAppender

    function AjaxAppender(url, withCredentials) {
      var appender = this;

      var isSupported = true;

      if (!url) {
        handleError("AjaxAppender: URL must be specified in constructor");

        isSupported = false;
      }

      var timed = this.defaults.timed;

      var waitForResponse = this.defaults.waitForResponse;

      var batchSize = this.defaults.batchSize;

      var timerInterval = this.defaults.timerInterval;

      var requestSuccessCallback = this.defaults.requestSuccessCallback;

      var failCallback = this.defaults.failCallback;

      var postVarName = this.defaults.postVarName;

      var sendAllOnUnload = this.defaults.sendAllOnUnload;

      var contentType = this.defaults.contentType;

      var sessionId = null;

      var queuedLoggingEvents = [];

      var queuedRequests = [];

      var headers = [];

      var sending = false;

      var initialized = false;

      // Configuration methods. The function scope is used to prevent

      // direct alteration to the appender configuration properties.

      function checkCanConfigure(configOptionName) {
        if (initialized) {
          handleError(
            "AjaxAppender: configuration option '" +
              configOptionName +
              "' may not be set after the appender has been initialized"
          );

          return false;
        }

        return true;
      }

      this.getSessionId = function () {
        return sessionId;
      };

      this.setSessionId = function (sessionIdParam) {
        sessionId = extractStringFromParam(sessionIdParam, null);

        this.layout.setCustomField("sessionid", sessionId);
      };

      this.setLayout = function (layoutParam) {
        if (checkCanConfigure("layout")) {
          this.layout = layoutParam;

          // Set the session id as a custom field on the layout, if not already present

          if (sessionId !== null) {
            this.setSessionId(sessionId);
          }
        }
      };

      this.isTimed = function () {
        return timed;
      };

      this.setTimed = function (timedParam) {
        if (checkCanConfigure("timed")) {
          timed = bool(timedParam);
        }
      };

      this.getTimerInterval = function () {
        return timerInterval;
      };

      this.setTimerInterval = function (timerIntervalParam) {
        if (checkCanConfigure("timerInterval")) {
          timerInterval = extractIntFromParam(
            timerIntervalParam,
            timerInterval
          );
        }
      };

      this.isWaitForResponse = function () {
        return waitForResponse;
      };

      this.setWaitForResponse = function (waitForResponseParam) {
        if (checkCanConfigure("waitForResponse")) {
          waitForResponse = bool(waitForResponseParam);
        }
      };

      this.getBatchSize = function () {
        return batchSize;
      };

      this.setBatchSize = function (batchSizeParam) {
        if (checkCanConfigure("batchSize")) {
          batchSize = extractIntFromParam(batchSizeParam, batchSize);
        }
      };

      this.isSendAllOnUnload = function () {
        return sendAllOnUnload;
      };

      this.setSendAllOnUnload = function (sendAllOnUnloadParam) {
        if (checkCanConfigure("sendAllOnUnload")) {
          sendAllOnUnload = extractBooleanFromParam(
            sendAllOnUnloadParam,
            sendAllOnUnload
          );
        }
      };

      this.setRequestSuccessCallback = function (requestSuccessCallbackParam) {
        requestSuccessCallback = extractFunctionFromParam(
          requestSuccessCallbackParam,
          requestSuccessCallback
        );
      };

      this.setFailCallback = function (failCallbackParam) {
        failCallback = extractFunctionFromParam(
          failCallbackParam,
          failCallback
        );
      };

      this.getPostVarName = function () {
        return postVarName;
      };

      this.setPostVarName = function (postVarNameParam) {
        if (checkCanConfigure("postVarName")) {
          postVarName = extractStringFromParam(postVarNameParam, postVarName);
        }
      };

      this.getHeaders = function () {
        return headers;
      };

      this.addHeader = function (name, value) {
        if (name.toLowerCase() == "content-type") {
          contentType = value;
        } else {
          headers.push({ name: name, value: value });
        }
      };

      // Internal functions

      function sendAll() {
        if (isSupported && enabled) {
          sending = true;

          var currentRequestBatch;

          if (waitForResponse) {
            // Send the first request then use this function as the callback once

            // the response comes back

            if (queuedRequests.length > 0) {
              currentRequestBatch = queuedRequests.shift();

              sendRequest(preparePostData(currentRequestBatch), sendAll);
            } else {
              sending = false;

              if (timed) {
                scheduleSending();
              }
            }
          } else {
            // Rattle off all the requests without waiting to see the response

            while ((currentRequestBatch = queuedRequests.shift())) {
              sendRequest(preparePostData(currentRequestBatch));
            }

            sending = false;

            if (timed) {
              scheduleSending();
            }
          }
        }
      }

      this.sendAll = sendAll;

      // Called when the window unloads. At this point we're past caring about

      // waiting for responses or timers or incomplete batches - everything

      // must go, now

      function sendAllRemaining() {
        var sendingAnything = false;

        if (isSupported && enabled) {
          // Create requests for everything left over, batched as normal

          var actualBatchSize = appender.getLayout().allowBatching()
            ? batchSize
            : 1;

          var currentLoggingEvent;

          var batchedLoggingEvents = [];

          while ((currentLoggingEvent = queuedLoggingEvents.shift())) {
            batchedLoggingEvents.push(currentLoggingEvent);

            if (queuedLoggingEvents.length >= actualBatchSize) {
              // Queue this batch of log entries

              queuedRequests.push(batchedLoggingEvents);

              batchedLoggingEvents = [];
            }
          }

          // If there's a partially completed batch, add it

          if (batchedLoggingEvents.length > 0) {
            queuedRequests.push(batchedLoggingEvents);
          }

          sendingAnything = queuedRequests.length > 0;

          waitForResponse = false;

          timed = false;

          sendAll();
        }

        return sendingAnything;
      }

      this.sendAllRemaining = sendAllRemaining;

      function preparePostData(batchedLoggingEvents) {
        // Format the logging events

        var formattedMessages = [];

        var currentLoggingEvent;

        var postData = "";

        while ((currentLoggingEvent = batchedLoggingEvents.shift())) {
          formattedMessages.push(
            appender.getLayout().formatWithException(currentLoggingEvent)
          );
        }

        // Create the post data string

        if (batchedLoggingEvents.length == 1) {
          postData = formattedMessages.join("");
        } else {
          postData =
            appender.getLayout().batchHeader +
            formattedMessages.join(appender.getLayout().batchSeparator) +
            appender.getLayout().batchFooter;
        }

        if (contentType == appender.defaults.contentType) {
          postData = appender.getLayout().returnsPostData
            ? postData
            : urlEncode(postVarName) + "=" + urlEncode(postData);

          // Add the layout name to the post data

          if (postData.length > 0) {
            postData += "&";
          }

          postData += "layout=" + urlEncode(appender.getLayout().toString());
        }

        return postData;
      }

      function scheduleSending() {
        window.setTimeout(sendAll, timerInterval);
      }

      function xmlHttpErrorHandler() {
        var msg =
          "AjaxAppender: could not create XMLHttpRequest object. AjaxAppender disabled";

        handleError(msg);

        isSupported = false;

        if (failCallback) {
          failCallback(msg);
        }
      }

      function sendRequest(postData, successCallback) {
        try {
          var xmlHttp = getXmlHttp(xmlHttpErrorHandler);

          if (isSupported) {
            xmlHttp.onreadystatechange = function () {
              if (xmlHttp.readyState == 4) {
                if (isHttpRequestSuccessful(xmlHttp)) {
                  if (requestSuccessCallback) {
                    requestSuccessCallback(xmlHttp);
                  }

                  if (successCallback) {
                    successCallback(xmlHttp);
                  }
                } else {
                  var msg =
                    "AjaxAppender.append: XMLHttpRequest request to URL " +
                    url +
                    " returned status code " +
                    xmlHttp.status;

                  handleError(msg);

                  if (failCallback) {
                    failCallback(msg);
                  }
                }

                xmlHttp.onreadystatechange = emptyFunction;

                xmlHttp = null;
              }
            };

            xmlHttp.open("POST", url, true);

            // Add withCredentials to facilitate CORS requests with cookies

            if (withCredentials && withCredentialsSupported) {
              xmlHttp.withCredentials = true;
            }

            try {
              for (var i = 0, header; (header = headers[i++]); ) {
                xmlHttp.setRequestHeader(header.name, header.value);
              }

              xmlHttp.setRequestHeader("Content-Type", contentType);
            } catch (headerEx) {
              var msg =
                "AjaxAppender.append: your browser's XMLHttpRequest implementation" +
                " does not support setRequestHeader, therefore cannot post data. AjaxAppender disabled";

              handleError(msg);

              isSupported = false;

              if (failCallback) {
                failCallback(msg);
              }

              return;
            }

            xmlHttp.send(postData);
          }
        } catch (ex) {
          var errMsg =
            "AjaxAppender.append: error sending log message to " + url;

          handleError(errMsg, ex);

          isSupported = false;

          if (failCallback) {
            failCallback(errMsg + ". Details: " + getExceptionStringRep(ex));
          }
        }
      }

      this.append = function (loggingEvent) {
        if (isSupported) {
          if (!initialized) {
            init();
          }

          queuedLoggingEvents.push(loggingEvent);

          var actualBatchSize = this.getLayout().allowBatching()
            ? batchSize
            : 1;

          if (queuedLoggingEvents.length >= actualBatchSize) {
            var currentLoggingEvent;

            var batchedLoggingEvents = [];

            while ((currentLoggingEvent = queuedLoggingEvents.shift())) {
              batchedLoggingEvents.push(currentLoggingEvent);
            }

            // Queue this batch of log entries

            queuedRequests.push(batchedLoggingEvents);

            // If using a timer, the queue of requests will be processed by the

            // timer function, so nothing needs to be done here.

            if (!timed && (!waitForResponse || (waitForResponse && !sending))) {
              sendAll();
            }
          }
        }
      };

      function init() {
        initialized = true;

        // Add unload event to send outstanding messages

        if (sendAllOnUnload) {
          var oldBeforeUnload = window.onbeforeunload;

          window.onbeforeunload = function () {
            if (oldBeforeUnload) {
              oldBeforeUnload();
            }

            sendAllRemaining();
          };
        }

        // Start timer

        if (timed) {
          scheduleSending();
        }
      }
    }

    AjaxAppender.prototype = new Appender();

    AjaxAppender.prototype.defaults = {
      waitForResponse: false,

      timed: false,

      timerInterval: 1000,

      batchSize: 1,

      sendAllOnUnload: false,

      requestSuccessCallback: null,

      failCallback: null,

      postVarName: "data",

      contentType: "application/x-www-form-urlencoded",
    };

    AjaxAppender.prototype.layout = new HttpPostDataLayout();

    AjaxAppender.prototype.toString = function () {
      return "AjaxAppender";
    };

    log4javascript.AjaxAppender = AjaxAppender;

    /* ---------------------------------------------------------------------- */

    // PopUpAppender and InPageAppender related

    function setCookie(name, value, days, path) {
      var expires;

      path = path ? "; path=" + path : "";

      if (days) {
        var date = new Date();

        date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);

        expires = "; expires=" + date.toGMTString();
      } else {
        expires = "";
      }

      document.cookie = escape(name) + "=" + escape(value) + expires + path;
    }

    function getCookie(name) {
      var nameEquals = escape(name) + "=";

      var ca = document.cookie.split(";");

      for (var i = 0, len = ca.length; i < len; i++) {
        var c = ca[i];

        while (c.charAt(0) === " ") {
          c = c.substring(1, c.length);
        }

        if (c.indexOf(nameEquals) === 0) {
          return unescape(c.substring(nameEquals.length, c.length));
        }
      }

      return null;
    }

    // Gets the base URL of the location of the log4javascript script.

    // This is far from infallible.

    function getBaseUrl() {
      var scripts = document.getElementsByTagName("script");

      for (var i = 0, len = scripts.length; i < len; ++i) {
        if (scripts[i].src.indexOf("log4javascript") != -1) {
          var lastSlash = scripts[i].src.lastIndexOf("/");

          return lastSlash == -1 ? "" : scripts[i].src.substr(0, lastSlash + 1);
        }
      }

      return null;
    }

    function isLoaded(win) {
      try {
        return bool(win.loaded);
      } catch (ex) {
        return false;
      }
    }

    /* ---------------------------------------------------------------------- */

    // ConsoleAppender (prototype for PopUpAppender and InPageAppender)

    var ConsoleAppender;

    // Create an anonymous function to protect base console methods

    (function () {
      var getConsoleHtmlLines = function () {
        return [
          '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">',

          '<html xmlns="http://www.w3.org/1999/xhtml" lang="en" xml:lang="en">',

          "	<head>",

          "		<title>log4javascript</title>",

          '		<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />',

          "		<!-- Make IE8 behave like IE7, having gone to all the trouble of making IE work -->",

          '		<meta http-equiv="X-UA-Compatible" content="IE=7" />',

          '		<script type="text/javascript">var isIe = false, isIePre7 = false;</script>',

          '		<!--[if IE]><script type="text/javascript">isIe = true</script><![endif]-->',

          '		<!--[if lt IE 7]><script type="text/javascript">isIePre7 = true</script><![endif]-->',

          '		<script type="text/javascript">',

          "			//<![CDATA[",

          "			var loggingEnabled = true;",

          "			var logQueuedEventsTimer = null;",

          "			var logEntries = [];",

          "			var logEntriesAndSeparators = [];",

          "			var logItems = [];",

          "			var renderDelay = 100;",

          "			var unrenderedLogItemsExist = false;",

          "			var rootGroup, currentGroup = null;",

          "			var loaded = false;",

          "			var currentLogItem = null;",

          "			var logMainContainer;",

          "",

          "			function copyProperties(obj, props) {",

          "				for (var i in props) {",

          "					obj[i] = props[i];",

          "				}",

          "			}",

          "",

          "			/*----------------------------------------------------------------*/",

          "",

          "			function LogItem() {",

          "			}",

          "",

          "			LogItem.prototype = {",

          "				mainContainer: null,",

          "				wrappedContainer: null,",

          "				unwrappedContainer: null,",

          "				group: null,",

          "",

          "				appendToLog: function() {",

          "					for (var i = 0, len = this.elementContainers.length; i < len; i++) {",

          "						this.elementContainers[i].appendToLog();",

          "					}",

          "					this.group.update();",

          "				},",

          "",

          "				doRemove: function(doUpdate, removeFromGroup) {",

          "					if (this.rendered) {",

          "						for (var i = 0, len = this.elementContainers.length; i < len; i++) {",

          "							this.elementContainers[i].remove();",

          "						}",

          "						this.unwrappedElementContainer = null;",

          "						this.wrappedElementContainer = null;",

          "						this.mainElementContainer = null;",

          "					}",

          "					if (this.group && removeFromGroup) {",

          "						this.group.removeChild(this, doUpdate);",

          "					}",

          "					if (this === currentLogItem) {",

          "						currentLogItem = null;",

          "					}",

          "				},",

          "",

          "				remove: function(doUpdate, removeFromGroup) {",

          "					this.doRemove(doUpdate, removeFromGroup);",

          "				},",

          "",

          "				render: function() {},",

          "",

          "				accept: function(visitor) {",

          "					visitor.visit(this);",

          "				},",

          "",

          "				getUnwrappedDomContainer: function() {",

          "					return this.group.unwrappedElementContainer.contentDiv;",

          "				},",

          "",

          "				getWrappedDomContainer: function() {",

          "					return this.group.wrappedElementContainer.contentDiv;",

          "				},",

          "",

          "				getMainDomContainer: function() {",

          "					return this.group.mainElementContainer.contentDiv;",

          "				}",

          "			};",

          "",

          "			LogItem.serializedItemKeys = {LOG_ENTRY: 0, GROUP_START: 1, GROUP_END: 2};",

          "",

          "			/*----------------------------------------------------------------*/",

          "",

          "			function LogItemContainerElement() {",

          "			}",

          "",

          "			LogItemContainerElement.prototype = {",

          "				appendToLog: function() {",

          "					var insertBeforeFirst = (newestAtTop && this.containerDomNode.hasChildNodes());",

          "					if (insertBeforeFirst) {",

          "						this.containerDomNode.insertBefore(this.mainDiv, this.containerDomNode.firstChild);",

          "					} else {",

          "						this.containerDomNode.appendChild(this.mainDiv);",

          "					}",

          "				}",

          "			};",

          "",

          "			/*----------------------------------------------------------------*/",

          "",

          "			function SeparatorElementContainer(containerDomNode) {",

          "				this.containerDomNode = containerDomNode;",

          '				this.mainDiv = document.createElement("div");',

          '				this.mainDiv.className = "separator";',

          '				this.mainDiv.innerHTML = "&nbsp;";',

          "			}",

          "",

          "			SeparatorElementContainer.prototype = new LogItemContainerElement();",

          "",

          "			SeparatorElementContainer.prototype.remove = function() {",

          "				this.mainDiv.parentNode.removeChild(this.mainDiv);",

          "				this.mainDiv = null;",

          "			};",

          "",

          "			/*----------------------------------------------------------------*/",

          "",

          "			function Separator() {",

          "				this.rendered = false;",

          "			}",

          "",

          "			Separator.prototype = new LogItem();",

          "",

          "			copyProperties(Separator.prototype, {",

          "				render: function() {",

          "					var containerDomNode = this.group.contentDiv;",

          "					if (isIe) {",

          "						this.unwrappedElementContainer = new SeparatorElementContainer(this.getUnwrappedDomContainer());",

          "						this.wrappedElementContainer = new SeparatorElementContainer(this.getWrappedDomContainer());",

          "						this.elementContainers = [this.unwrappedElementContainer, this.wrappedElementContainer];",

          "					} else {",

          "						this.mainElementContainer = new SeparatorElementContainer(this.getMainDomContainer());",

          "						this.elementContainers = [this.mainElementContainer];",

          "					}",

          "					this.content = this.formattedMessage;",

          "					this.rendered = true;",

          "				}",

          "			});",

          "",

          "			/*----------------------------------------------------------------*/",

          "",

          "			function GroupElementContainer(group, containerDomNode, isRoot, isWrapped) {",

          "				this.group = group;",

          "				this.containerDomNode = containerDomNode;",

          "				this.isRoot = isRoot;",

          "				this.isWrapped = isWrapped;",

          "				this.expandable = false;",

          "",

          "				if (this.isRoot) {",

          "					if (isIe) {",

          '						this.contentDiv = logMainContainer.appendChild(document.createElement("div"));',

          '						this.contentDiv.id = this.isWrapped ? "log_wrapped" : "log_unwrapped";',

          "					} else {",

          "						this.contentDiv = logMainContainer;",

          "					}",

          "				} else {",

          "					var groupElementContainer = this;",

          "",

          '					this.mainDiv = document.createElement("div");',

          '					this.mainDiv.className = "group";',

          "",

          '					this.headingDiv = this.mainDiv.appendChild(document.createElement("div"));',

          '					this.headingDiv.className = "groupheading";',

          "",

          '					this.expander = this.headingDiv.appendChild(document.createElement("span"));',

          '					this.expander.className = "expander unselectable greyedout";',

          "					this.expander.unselectable = true;",

          '					var expanderText = this.group.expanded ? "-" : "+";',

          "					this.expanderTextNode = this.expander.appendChild(document.createTextNode(expanderText));",

          "",

          '					this.headingDiv.appendChild(document.createTextNode(" " + this.group.name));',

          "",

          '					this.contentDiv = this.mainDiv.appendChild(document.createElement("div"));',

          '					var contentCssClass = this.group.expanded ? "expanded" : "collapsed";',

          '					this.contentDiv.className = "groupcontent " + contentCssClass;',

          "",

          "					this.expander.onclick = function() {",

          "						if (groupElementContainer.group.expandable) {",

          "							groupElementContainer.group.toggleExpanded();",

          "						}",

          "					};",

          "				}",

          "			}",

          "",

          "			GroupElementContainer.prototype = new LogItemContainerElement();",

          "",

          "			copyProperties(GroupElementContainer.prototype, {",

          "				toggleExpanded: function() {",

          "					if (!this.isRoot) {",

          "						var oldCssClass, newCssClass, expanderText;",

          "						if (this.group.expanded) {",

          '							newCssClass = "expanded";',

          '							oldCssClass = "collapsed";',

          '							expanderText = "-";',

          "						} else {",

          '							newCssClass = "collapsed";',

          '							oldCssClass = "expanded";',

          '							expanderText = "+";',

          "						}",

          "						replaceClass(this.contentDiv, newCssClass, oldCssClass);",

          "						this.expanderTextNode.nodeValue = expanderText;",

          "					}",

          "				},",

          "",

          "				remove: function() {",

          "					if (!this.isRoot) {",

          "						this.headingDiv = null;",

          "						this.expander.onclick = null;",

          "						this.expander = null;",

          "						this.expanderTextNode = null;",

          "						this.contentDiv = null;",

          "						this.containerDomNode = null;",

          "						this.mainDiv.parentNode.removeChild(this.mainDiv);",

          "						this.mainDiv = null;",

          "					}",

          "				},",

          "",

          "				reverseChildren: function() {",

          "					// Invert the order of the log entries",

          "					var node = null;",

          "",

          "					// Remove all the log container nodes",

          "					var childDomNodes = [];",

          "					while ((node = this.contentDiv.firstChild)) {",

          "						this.contentDiv.removeChild(node);",

          "						childDomNodes.push(node);",

          "					}",

          "",

          "					// Put them all back in reverse order",

          "					while ((node = childDomNodes.pop())) {",

          "						this.contentDiv.appendChild(node);",

          "					}",

          "				},",

          "",

          "				update: function() {",

          "					if (!this.isRoot) {",

          "						if (this.group.expandable) {",

          '							removeClass(this.expander, "greyedout");',

          "						} else {",

          '							addClass(this.expander, "greyedout");',

          "						}",

          "					}",

          "				},",

          "",

          "				clear: function() {",

          "					if (this.isRoot) {",

          '						this.contentDiv.innerHTML = "";',

          "					}",

          "				}",

          "			});",

          "",

          "			/*----------------------------------------------------------------*/",

          "",

          "			function Group(name, isRoot, initiallyExpanded) {",

          "				this.name = name;",

          "				this.group = null;",

          "				this.isRoot = isRoot;",

          "				this.initiallyExpanded = initiallyExpanded;",

          "				this.elementContainers = [];",

          "				this.children = [];",

          "				this.expanded = initiallyExpanded;",

          "				this.rendered = false;",

          "				this.expandable = false;",

          "			}",

          "",

          "			Group.prototype = new LogItem();",

          "",

          "			copyProperties(Group.prototype, {",

          "				addChild: function(logItem) {",

          "					this.children.push(logItem);",

          "					logItem.group = this;",

          "				},",

          "",

          "				render: function() {",

          "					if (isIe) {",

          "						var unwrappedDomContainer, wrappedDomContainer;",

          "						if (this.isRoot) {",

          "							unwrappedDomContainer = logMainContainer;",

          "							wrappedDomContainer = logMainContainer;",

          "						} else {",

          "							unwrappedDomContainer = this.getUnwrappedDomContainer();",

          "							wrappedDomContainer = this.getWrappedDomContainer();",

          "						}",

          "						this.unwrappedElementContainer = new GroupElementContainer(this, unwrappedDomContainer, this.isRoot, false);",

          "						this.wrappedElementContainer = new GroupElementContainer(this, wrappedDomContainer, this.isRoot, true);",

          "						this.elementContainers = [this.unwrappedElementContainer, this.wrappedElementContainer];",

          "					} else {",

          "						var mainDomContainer = this.isRoot ? logMainContainer : this.getMainDomContainer();",

          "						this.mainElementContainer = new GroupElementContainer(this, mainDomContainer, this.isRoot, false);",

          "						this.elementContainers = [this.mainElementContainer];",

          "					}",

          "					this.rendered = true;",

          "				},",

          "",

          "				toggleExpanded: function() {",

          "					this.expanded = !this.expanded;",

          "					for (var i = 0, len = this.elementContainers.length; i < len; i++) {",

          "						this.elementContainers[i].toggleExpanded();",

          "					}",

          "				},",

          "",

          "				expand: function() {",

          "					if (!this.expanded) {",

          "						this.toggleExpanded();",

          "					}",

          "				},",

          "",

          "				accept: function(visitor) {",

          "					visitor.visitGroup(this);",

          "				},",

          "",

          "				reverseChildren: function() {",

          "					if (this.rendered) {",

          "						for (var i = 0, len = this.elementContainers.length; i < len; i++) {",

          "							this.elementContainers[i].reverseChildren();",

          "						}",

          "					}",

          "				},",

          "",

          "				update: function() {",

          "					var previouslyExpandable = this.expandable;",

          "					this.expandable = (this.children.length !== 0);",

          "					if (this.expandable !== previouslyExpandable) {",

          "						for (var i = 0, len = this.elementContainers.length; i < len; i++) {",

          "							this.elementContainers[i].update();",

          "						}",

          "					}",

          "				},",

          "",

          "				flatten: function() {",

          "					var visitor = new GroupFlattener();",

          "					this.accept(visitor);",

          "					return visitor.logEntriesAndSeparators;",

          "				},",

          "",

          "				removeChild: function(child, doUpdate) {",

          "					array_remove(this.children, child);",

          "					child.group = null;",

          "					if (doUpdate) {",

          "						this.update();",

          "					}",

          "				},",

          "",

          "				remove: function(doUpdate, removeFromGroup) {",

          "					for (var i = 0, len = this.children.length; i < len; i++) {",

          "						this.children[i].remove(false, false);",

          "					}",

          "					this.children = [];",

          "					this.update();",

          "					if (this === currentGroup) {",

          "						currentGroup = this.group;",

          "					}",

          "					this.doRemove(doUpdate, removeFromGroup);",

          "				},",

          "",

          "				serialize: function(items) {",

          "					items.push([LogItem.serializedItemKeys.GROUP_START, this.name]);",

          "					for (var i = 0, len = this.children.length; i < len; i++) {",

          "						this.children[i].serialize(items);",

          "					}",

          "					if (this !== currentGroup) {",

          "						items.push([LogItem.serializedItemKeys.GROUP_END]);",

          "					}",

          "				},",

          "",

          "				clear: function() {",

          "					for (var i = 0, len = this.elementContainers.length; i < len; i++) {",

          "						this.elementContainers[i].clear();",

          "					}",

          "				}",

          "			});",

          "",

          "			/*----------------------------------------------------------------*/",

          "",

          "			function LogEntryElementContainer() {",

          "			}",

          "",

          "			LogEntryElementContainer.prototype = new LogItemContainerElement();",

          "",

          "			copyProperties(LogEntryElementContainer.prototype, {",

          "				remove: function() {",

          "					this.doRemove();",

          "				},",

          "",

          "				doRemove: function() {",

          "					this.mainDiv.parentNode.removeChild(this.mainDiv);",

          "					this.mainDiv = null;",

          "					this.contentElement = null;",

          "					this.containerDomNode = null;",

          "				},",

          "",

          "				setContent: function(content, wrappedContent) {",

          "					if (content === this.formattedMessage) {",

          '						this.contentElement.innerHTML = "";',

          "						this.contentElement.appendChild(document.createTextNode(this.formattedMessage));",

          "					} else {",

          "						this.contentElement.innerHTML = content;",

          "					}",

          "				},",

          "",

          "				setSearchMatch: function(isMatch) {",

          '					var oldCssClass = isMatch ? "searchnonmatch" : "searchmatch";',

          '					var newCssClass = isMatch ? "searchmatch" : "searchnonmatch";',

          "					replaceClass(this.mainDiv, newCssClass, oldCssClass);",

          "				},",

          "",

          "				clearSearch: function() {",

          '					removeClass(this.mainDiv, "searchmatch");',

          '					removeClass(this.mainDiv, "searchnonmatch");',

          "				}",

          "			});",

          "",

          "			/*----------------------------------------------------------------*/",

          "",

          "			function LogEntryWrappedElementContainer(logEntry, containerDomNode) {",

          "				this.logEntry = logEntry;",

          "				this.containerDomNode = containerDomNode;",

          '				this.mainDiv = document.createElement("div");',

          "				this.mainDiv.appendChild(document.createTextNode(this.logEntry.formattedMessage));",

          '				this.mainDiv.className = "logentry wrapped " + this.logEntry.level;',

          "				this.contentElement = this.mainDiv;",

          "			}",

          "",

          "			LogEntryWrappedElementContainer.prototype = new LogEntryElementContainer();",

          "",

          "			LogEntryWrappedElementContainer.prototype.setContent = function(content, wrappedContent) {",

          "				if (content === this.formattedMessage) {",

          '					this.contentElement.innerHTML = "";',

          "					this.contentElement.appendChild(document.createTextNode(this.formattedMessage));",

          "				} else {",

          "					this.contentElement.innerHTML = wrappedContent;",

          "				}",

          "			};",

          "",

          "			/*----------------------------------------------------------------*/",

          "",

          "			function LogEntryUnwrappedElementContainer(logEntry, containerDomNode) {",

          "				this.logEntry = logEntry;",

          "				this.containerDomNode = containerDomNode;",

          '				this.mainDiv = document.createElement("div");',

          '				this.mainDiv.className = "logentry unwrapped " + this.logEntry.level;',

          '				this.pre = this.mainDiv.appendChild(document.createElement("pre"));',

          "				this.pre.appendChild(document.createTextNode(this.logEntry.formattedMessage));",

          '				this.pre.className = "unwrapped";',

          "				this.contentElement = this.pre;",

          "			}",

          "",

          "			LogEntryUnwrappedElementContainer.prototype = new LogEntryElementContainer();",

          "",

          "			LogEntryUnwrappedElementContainer.prototype.remove = function() {",

          "				this.doRemove();",

          "				this.pre = null;",

          "			};",

          "",

          "			/*----------------------------------------------------------------*/",

          "",

          "			function LogEntryMainElementContainer(logEntry, containerDomNode) {",

          "				this.logEntry = logEntry;",

          "				this.containerDomNode = containerDomNode;",

          '				this.mainDiv = document.createElement("div");',

          '				this.mainDiv.className = "logentry nonielogentry " + this.logEntry.level;',

          '				this.contentElement = this.mainDiv.appendChild(document.createElement("span"));',

          "				this.contentElement.appendChild(document.createTextNode(this.logEntry.formattedMessage));",

          "			}",

          "",

          "			LogEntryMainElementContainer.prototype = new LogEntryElementContainer();",

          "",

          "			/*----------------------------------------------------------------*/",

          "",

          "			function LogEntry(level, formattedMessage) {",

          "				this.level = level;",

          "				this.formattedMessage = formattedMessage;",

          "				this.rendered = false;",

          "			}",

          "",

          "			LogEntry.prototype = new LogItem();",

          "",

          "			copyProperties(LogEntry.prototype, {",

          "				render: function() {",

          "					var logEntry = this;",

          "					var containerDomNode = this.group.contentDiv;",

          "",

          "					// Support for the CSS attribute white-space in IE for Windows is",

          "					// non-existent pre version 6 and slightly odd in 6, so instead",

          "					// use two different HTML elements",

          "					if (isIe) {",

          '						this.formattedMessage = this.formattedMessage.replace(/\\r\\n/g, "\\r"); // Workaround for IE\'s treatment of white space',

          "						this.unwrappedElementContainer = new LogEntryUnwrappedElementContainer(this, this.getUnwrappedDomContainer());",

          "						this.wrappedElementContainer = new LogEntryWrappedElementContainer(this, this.getWrappedDomContainer());",

          "						this.elementContainers = [this.unwrappedElementContainer, this.wrappedElementContainer];",

          "					} else {",

          "						this.mainElementContainer = new LogEntryMainElementContainer(this, this.getMainDomContainer());",

          "						this.elementContainers = [this.mainElementContainer];",

          "					}",

          "					this.content = this.formattedMessage;",

          "					this.rendered = true;",

          "				},",

          "",

          "				setContent: function(content, wrappedContent) {",

          "					if (content != this.content) {",

          "						if (isIe && (content !== this.formattedMessage)) {",

          '							content = content.replace(/\\r\\n/g, "\\r"); // Workaround for IE\'s treatment of white space',

          "						}",

          "						for (var i = 0, len = this.elementContainers.length; i < len; i++) {",

          "							this.elementContainers[i].setContent(content, wrappedContent);",

          "						}",

          "						this.content = content;",

          "					}",

          "				},",

          "",

          "				getSearchMatches: function() {",

          "					var matches = [];",

          "					var i, len;",

          "					if (isIe) {",

          '						var unwrappedEls = getElementsByClass(this.unwrappedElementContainer.mainDiv, "searchterm", "span");',

          '						var wrappedEls = getElementsByClass(this.wrappedElementContainer.mainDiv, "searchterm", "span");',

          "						for (i = 0, len = unwrappedEls.length; i < len; i++) {",

          "							matches[i] = new Match(this.level, null, unwrappedEls[i], wrappedEls[i]);",

          "						}",

          "					} else {",

          '						var els = getElementsByClass(this.mainElementContainer.mainDiv, "searchterm", "span");',

          "						for (i = 0, len = els.length; i < len; i++) {",

          "							matches[i] = new Match(this.level, els[i]);",

          "						}",

          "					}",

          "					return matches;",

          "				},",

          "",

          "				setSearchMatch: function(isMatch) {",

          "					for (var i = 0, len = this.elementContainers.length; i < len; i++) {",

          "						this.elementContainers[i].setSearchMatch(isMatch);",

          "					}",

          "				},",

          "",

          "				clearSearch: function() {",

          "					for (var i = 0, len = this.elementContainers.length; i < len; i++) {",

          "						this.elementContainers[i].clearSearch();",

          "					}",

          "				},",

          "",

          "				accept: function(visitor) {",

          "					visitor.visitLogEntry(this);",

          "				},",

          "",

          "				serialize: function(items) {",

          "					items.push([LogItem.serializedItemKeys.LOG_ENTRY, this.level, this.formattedMessage]);",

          "				}",

          "			});",

          "",

          "			/*----------------------------------------------------------------*/",

          "",

          "			function LogItemVisitor() {",

          "			}",

          "",

          "			LogItemVisitor.prototype = {",

          "				visit: function(logItem) {",

          "				},",

          "",

          "				visitParent: function(logItem) {",

          "					if (logItem.group) {",

          "						logItem.group.accept(this);",

          "					}",

          "				},",

          "",

          "				visitChildren: function(logItem) {",

          "					for (var i = 0, len = logItem.children.length; i < len; i++) {",

          "						logItem.children[i].accept(this);",

          "					}",

          "				},",

          "",

          "				visitLogEntry: function(logEntry) {",

          "					this.visit(logEntry);",

          "				},",

          "",

          "				visitSeparator: function(separator) {",

          "					this.visit(separator);",

          "				},",

          "",

          "				visitGroup: function(group) {",

          "					this.visit(group);",

          "				}",

          "			};",

          "",

          "			/*----------------------------------------------------------------*/",

          "",

          "			function GroupFlattener() {",

          "				this.logEntriesAndSeparators = [];",

          "			}",

          "",

          "			GroupFlattener.prototype = new LogItemVisitor();",

          "",

          "			GroupFlattener.prototype.visitGroup = function(group) {",

          "				this.visitChildren(group);",

          "			};",

          "",

          "			GroupFlattener.prototype.visitLogEntry = function(logEntry) {",

          "				this.logEntriesAndSeparators.push(logEntry);",

          "			};",

          "",

          "			GroupFlattener.prototype.visitSeparator = function(separator) {",

          "				this.logEntriesAndSeparators.push(separator);",

          "			};",

          "",

          "			/*----------------------------------------------------------------*/",

          "",

          "			window.onload = function() {",

          "				// Sort out document.domain",

          "				if (location.search) {",

          '					var queryBits = unescape(location.search).substr(1).split("&"), nameValueBits;',

          "					for (var i = 0, len = queryBits.length; i < len; i++) {",

          '						nameValueBits = queryBits[i].split("=");',

          '						if (nameValueBits[0] == "log4javascript_domain") {',

          "							document.domain = nameValueBits[1];",

          "							break;",

          "						}",

          "					}",

          "				}",

          "",

          "				// Create DOM objects",

          '				logMainContainer = $("log");',

          "				if (isIePre7) {",

          '					addClass(logMainContainer, "oldIe");',

          "				}",

          "",

          '				rootGroup = new Group("root", true);',

          "				rootGroup.render();",

          "				currentGroup = rootGroup;",

          "",

          "				setCommandInputWidth();",

          "				setLogContainerHeight();",

          "				toggleLoggingEnabled();",

          "				toggleSearchEnabled();",

          "				toggleSearchFilter();",

          "				toggleSearchHighlight();",

          "				applyFilters();",

          "				checkAllLevels();",

          "				toggleWrap();",

          "				toggleNewestAtTop();",

          "				toggleScrollToLatest();",

          "				renderQueuedLogItems();",

          "				loaded = true;",

          '				$("command").value = "";',

          '				$("command").autocomplete = "off";',

          '				$("command").onkeydown = function(evt) {',

          "					evt = getEvent(evt);",

          "					if (evt.keyCode == 10 || evt.keyCode == 13) { // Return/Enter",

          "						evalCommandLine();",

          "						stopPropagation(evt);",

          "					} else if (evt.keyCode == 27) { // Escape",

          '						this.value = "";',

          "						this.focus();",

          "					} else if (evt.keyCode == 38 && commandHistory.length > 0) { // Up",

          "						currentCommandIndex = Math.max(0, currentCommandIndex - 1);",

          "						this.value = commandHistory[currentCommandIndex];",

          "						moveCaretToEnd(this);",

          "					} else if (evt.keyCode == 40 && commandHistory.length > 0) { // Down",

          "						currentCommandIndex = Math.min(commandHistory.length - 1, currentCommandIndex + 1);",

          "						this.value = commandHistory[currentCommandIndex];",

          "						moveCaretToEnd(this);",

          "					}",

          "				};",

          "",

          "				// Prevent the keypress moving the caret in Firefox",

          '				$("command").onkeypress = function(evt) {',

          "					evt = getEvent(evt);",

          "					if (evt.keyCode == 38 && commandHistory.length > 0 && evt.preventDefault) { // Up",

          "						evt.preventDefault();",

          "					}",

          "				};",

          "",

          "				// Prevent the keyup event blurring the input in Opera",

          '				$("command").onkeyup = function(evt) {',

          "					evt = getEvent(evt);",

          "					if (evt.keyCode == 27 && evt.preventDefault) { // Up",

          "						evt.preventDefault();",

          "						this.focus();",

          "					}",

          "				};",

          "",

          "				// Add document keyboard shortcuts",

          "				document.onkeydown = function keyEventHandler(evt) {",

          "					evt = getEvent(evt);",

          "					switch (evt.keyCode) {",

          "						case 69: // Ctrl + shift + E: re-execute last command",

          "							if (evt.shiftKey && (evt.ctrlKey || evt.metaKey)) {",

          "								evalLastCommand();",

          "								cancelKeyEvent(evt);",

          "								return false;",

          "							}",

          "							break;",

          "						case 75: // Ctrl + shift + K: focus search",

          "							if (evt.shiftKey && (evt.ctrlKey || evt.metaKey)) {",

          "								focusSearch();",

          "								cancelKeyEvent(evt);",

          "								return false;",

          "							}",

          "							break;",

          "						case 40: // Ctrl + shift + down arrow: focus command line",

          "						case 76: // Ctrl + shift + L: focus command line",

          "							if (evt.shiftKey && (evt.ctrlKey || evt.metaKey)) {",

          "								focusCommandLine();",

          "								cancelKeyEvent(evt);",

          "								return false;",

          "							}",

          "							break;",

          "					}",

          "				};",

          "",

          "				// Workaround to make sure log div starts at the correct size",

          "				setTimeout(setLogContainerHeight, 20);",

          "",

          "				setShowCommandLine(showCommandLine);",

          "				doSearch();",

          "			};",

          "",

          "			window.onunload = function() {",

          "				if (mainWindowExists()) {",

          "					appender.unload();",

          "				}",

          "				appender = null;",

          "			};",

          "",

          "			/*----------------------------------------------------------------*/",

          "",

          "			function toggleLoggingEnabled() {",

          '				setLoggingEnabled($("enableLogging").checked);',

          "			}",

          "",

          "			function setLoggingEnabled(enable) {",

          "				loggingEnabled = enable;",

          "			}",

          "",

          "			var appender = null;",

          "",

          "			function setAppender(appenderParam) {",

          "				appender = appenderParam;",

          "			}",

          "",

          "			function setShowCloseButton(showCloseButton) {",

          '				$("closeButton").style.display = showCloseButton ? "inline" : "none";',

          "			}",

          "",

          "			function setShowHideButton(showHideButton) {",

          '				$("hideButton").style.display = showHideButton ? "inline" : "none";',

          "			}",

          "",

          "			var newestAtTop = false;",

          "",

          "			/*----------------------------------------------------------------*/",

          "",

          "			function LogItemContentReverser() {",

          "			}",

          "",

          "			LogItemContentReverser.prototype = new LogItemVisitor();",

          "",

          "			LogItemContentReverser.prototype.visitGroup = function(group) {",

          "				group.reverseChildren();",

          "				this.visitChildren(group);",

          "			};",

          "",

          "			/*----------------------------------------------------------------*/",

          "",

          "			function setNewestAtTop(isNewestAtTop) {",

          "				var oldNewestAtTop = newestAtTop;",

          "				var i, iLen, j, jLen;",

          "				newestAtTop = Boolean(isNewestAtTop);",

          "				if (oldNewestAtTop != newestAtTop) {",

          "					var visitor = new LogItemContentReverser();",

          "					rootGroup.accept(visitor);",

          "",

          "					// Reassemble the matches array",

          "					if (currentSearch) {",

          "						var currentMatch = currentSearch.matches[currentMatchIndex];",

          "						var matchIndex = 0;",

          "						var matches = [];",

          "						var actOnLogEntry = function(logEntry) {",

          "							var logEntryMatches = logEntry.getSearchMatches();",

          "							for (j = 0, jLen = logEntryMatches.length; j < jLen; j++) {",

          "								matches[matchIndex] = logEntryMatches[j];",

          "								if (currentMatch && logEntryMatches[j].equals(currentMatch)) {",

          "									currentMatchIndex = matchIndex;",

          "								}",

          "								matchIndex++;",

          "							}",

          "						};",

          "						if (newestAtTop) {",

          "							for (i = logEntries.length - 1; i >= 0; i--) {",

          "								actOnLogEntry(logEntries[i]);",

          "							}",

          "						} else {",

          "							for (i = 0, iLen = logEntries.length; i < iLen; i++) {",

          "								actOnLogEntry(logEntries[i]);",

          "							}",

          "						}",

          "						currentSearch.matches = matches;",

          "						if (currentMatch) {",

          "							currentMatch.setCurrent();",

          "						}",

          "					} else if (scrollToLatest) {",

          "						doScrollToLatest();",

          "					}",

          "				}",

          '				$("newestAtTop").checked = isNewestAtTop;',

          "			}",

          "",

          "			function toggleNewestAtTop() {",

          '				var isNewestAtTop = $("newestAtTop").checked;',

          "				setNewestAtTop(isNewestAtTop);",

          "			}",

          "",

          "			var scrollToLatest = true;",

          "",

          "			function setScrollToLatest(isScrollToLatest) {",

          "				scrollToLatest = isScrollToLatest;",

          "				if (scrollToLatest) {",

          "					doScrollToLatest();",

          "				}",

          '				$("scrollToLatest").checked = isScrollToLatest;',

          "			}",

          "",

          "			function toggleScrollToLatest() {",

          '				var isScrollToLatest = $("scrollToLatest").checked;',

          "				setScrollToLatest(isScrollToLatest);",

          "			}",

          "",

          "			function doScrollToLatest() {",

          "				var l = logMainContainer;",

          '				if (typeof l.scrollTop != "undefined") {',

          "					if (newestAtTop) {",

          "						l.scrollTop = 0;",

          "					} else {",

          "						var latestLogEntry = l.lastChild;",

          "						if (latestLogEntry) {",

          "							l.scrollTop = l.scrollHeight;",

          "						}",

          "					}",

          "				}",

          "			}",

          "",

          "			var closeIfOpenerCloses = true;",

          "",

          "			function setCloseIfOpenerCloses(isCloseIfOpenerCloses) {",

          "				closeIfOpenerCloses = isCloseIfOpenerCloses;",

          "			}",

          "",

          "			var maxMessages = null;",

          "",

          "			function setMaxMessages(max) {",

          "				maxMessages = max;",

          "				pruneLogEntries();",

          "			}",

          "",

          "			var showCommandLine = false;",

          "",

          "			function setShowCommandLine(isShowCommandLine) {",

          "				showCommandLine = isShowCommandLine;",

          "				if (loaded) {",

          '					$("commandLine").style.display = showCommandLine ? "block" : "none";',

          "					setCommandInputWidth();",

          "					setLogContainerHeight();",

          "				}",

          "			}",

          "",

          "			function focusCommandLine() {",

          "				if (loaded) {",

          '					$("command").focus();',

          "				}",

          "			}",

          "",

          "			function focusSearch() {",

          "				if (loaded) {",

          '					$("searchBox").focus();',

          "				}",

          "			}",

          "",

          "			function getLogItems() {",

          "				var items = [];",

          "				for (var i = 0, len = logItems.length; i < len; i++) {",

          "					logItems[i].serialize(items);",

          "				}",

          "				return items;",

          "			}",

          "",

          "			function setLogItems(items) {",

          "				var loggingReallyEnabled = loggingEnabled;",

          "				// Temporarily turn logging on",

          "				loggingEnabled = true;",

          "				for (var i = 0, len = items.length; i < len; i++) {",

          "					switch (items[i][0]) {",

          "						case LogItem.serializedItemKeys.LOG_ENTRY:",

          "							log(items[i][1], items[i][2]);",

          "							break;",

          "						case LogItem.serializedItemKeys.GROUP_START:",

          "							group(items[i][1]);",

          "							break;",

          "						case LogItem.serializedItemKeys.GROUP_END:",

          "							groupEnd();",

          "							break;",

          "					}",

          "				}",

          "				loggingEnabled = loggingReallyEnabled;",

          "			}",

          "",

          "			function log(logLevel, formattedMessage) {",

          "				if (loggingEnabled) {",

          "					var logEntry = new LogEntry(logLevel, formattedMessage);",

          "					logEntries.push(logEntry);",

          "					logEntriesAndSeparators.push(logEntry);",

          "					logItems.push(logEntry);",

          "					currentGroup.addChild(logEntry);",

          "					if (loaded) {",

          "						if (logQueuedEventsTimer !== null) {",

          "							clearTimeout(logQueuedEventsTimer);",

          "						}",

          "						logQueuedEventsTimer = setTimeout(renderQueuedLogItems, renderDelay);",

          "						unrenderedLogItemsExist = true;",

          "					}",

          "				}",

          "			}",

          "",

          "			function renderQueuedLogItems() {",

          "				logQueuedEventsTimer = null;",

          "				var pruned = pruneLogEntries();",

          "",

          "				// Render any unrendered log entries and apply the current search to them",

          "				var initiallyHasMatches = currentSearch ? currentSearch.hasMatches() : false;",

          "				for (var i = 0, len = logItems.length; i < len; i++) {",

          "					if (!logItems[i].rendered) {",

          "						logItems[i].render();",

          "						logItems[i].appendToLog();",

          "						if (currentSearch && (logItems[i] instanceof LogEntry)) {",

          "							currentSearch.applyTo(logItems[i]);",

          "						}",

          "					}",

          "				}",

          "				if (currentSearch) {",

          "					if (pruned) {",

          "						if (currentSearch.hasVisibleMatches()) {",

          "							if (currentMatchIndex === null) {",

          "								setCurrentMatchIndex(0);",

          "							}",

          "							displayMatches();",

          "						} else {",

          "							displayNoMatches();",

          "						}",

          "					} else if (!initiallyHasMatches && currentSearch.hasVisibleMatches()) {",

          "						setCurrentMatchIndex(0);",

          "						displayMatches();",

          "					}",

          "				}",

          "				if (scrollToLatest) {",

          "					doScrollToLatest();",

          "				}",

          "				unrenderedLogItemsExist = false;",

          "			}",

          "",

          "			function pruneLogEntries() {",

          "				if ((maxMessages !== null) && (logEntriesAndSeparators.length > maxMessages)) {",

          "					var numberToDelete = logEntriesAndSeparators.length - maxMessages;",

          "					var prunedLogEntries = logEntriesAndSeparators.slice(0, numberToDelete);",

          "					if (currentSearch) {",

          "						currentSearch.removeMatches(prunedLogEntries);",

          "					}",

          "					var group;",

          "					for (var i = 0; i < numberToDelete; i++) {",

          "						group = logEntriesAndSeparators[i].group;",

          "						array_remove(logItems, logEntriesAndSeparators[i]);",

          "						array_remove(logEntries, logEntriesAndSeparators[i]);",

          "						logEntriesAndSeparators[i].remove(true, true);",

          "						if (group.children.length === 0 && group !== currentGroup && group !== rootGroup) {",

          "							array_remove(logItems, group);",

          "							group.remove(true, true);",

          "						}",

          "					}",

          "					logEntriesAndSeparators = array_removeFromStart(logEntriesAndSeparators, numberToDelete);",

          "					return true;",

          "				}",

          "				return false;",

          "			}",

          "",

          "			function group(name, startExpanded) {",

          "				if (loggingEnabled) {",

          '					initiallyExpanded = (typeof startExpanded === "undefined") ? true : Boolean(startExpanded);',

          "					var newGroup = new Group(name, false, initiallyExpanded);",

          "					currentGroup.addChild(newGroup);",

          "					currentGroup = newGroup;",

          "					logItems.push(newGroup);",

          "					if (loaded) {",

          "						if (logQueuedEventsTimer !== null) {",

          "							clearTimeout(logQueuedEventsTimer);",

          "						}",

          "						logQueuedEventsTimer = setTimeout(renderQueuedLogItems, renderDelay);",

          "						unrenderedLogItemsExist = true;",

          "					}",

          "				}",

          "			}",

          "",

          "			function groupEnd() {",

          "				currentGroup = (currentGroup === rootGroup) ? rootGroup : currentGroup.group;",

          "			}",

          "",

          "			function mainPageReloaded() {",

          "				currentGroup = rootGroup;",

          "				var separator = new Separator();",

          "				logEntriesAndSeparators.push(separator);",

          "				logItems.push(separator);",

          "				currentGroup.addChild(separator);",

          "			}",

          "",

          "			function closeWindow() {",

          "				if (appender && mainWindowExists()) {",

          "					appender.close(true);",

          "				} else {",

          "					window.close();",

          "				}",

          "			}",

          "",

          "			function hide() {",

          "				if (appender && mainWindowExists()) {",

          "					appender.hide();",

          "				}",

          "			}",

          "",

          "			var mainWindow = window;",

          '			var windowId = "log4javascriptConsoleWindow_" + new Date().getTime() + "_" + ("" + Math.random()).substr(2);',

          "",

          "			function setMainWindow(win) {",

          "				mainWindow = win;",

          "				mainWindow[windowId] = window;",

          "				// If this is a pop-up, poll the opener to see if it's closed",

          "				if (opener && closeIfOpenerCloses) {",

          "					pollOpener();",

          "				}",

          "			}",

          "",

          "			function pollOpener() {",

          "				if (closeIfOpenerCloses) {",

          "					if (mainWindowExists()) {",

          "						setTimeout(pollOpener, 500);",

          "					} else {",

          "						closeWindow();",

          "					}",

          "				}",

          "			}",

          "",

          "			function mainWindowExists() {",

          "				try {",

          "					return (mainWindow && !mainWindow.closed &&",

          "						mainWindow[windowId] == window);",

          "				} catch (ex) {}",

          "				return false;",

          "			}",

          "",

          '			var logLevels = ["TRACE", "DEBUG", "INFO", "WARN", "ERROR", "FATAL"];',

          "",

          "			function getCheckBox(logLevel) {",

          '				return $("switch_" + logLevel);',

          "			}",

          "",

          "			function getIeWrappedLogContainer() {",

          '				return $("log_wrapped");',

          "			}",

          "",

          "			function getIeUnwrappedLogContainer() {",

          '				return $("log_unwrapped");',

          "			}",

          "",

          "			function applyFilters() {",

          "				for (var i = 0; i < logLevels.length; i++) {",

          "					if (getCheckBox(logLevels[i]).checked) {",

          "						addClass(logMainContainer, logLevels[i]);",

          "					} else {",

          "						removeClass(logMainContainer, logLevels[i]);",

          "					}",

          "				}",

          "				updateSearchFromFilters();",

          "			}",

          "",

          "			function toggleAllLevels() {",

          '				var turnOn = $("switch_ALL").checked;',

          "				for (var i = 0; i < logLevels.length; i++) {",

          "					getCheckBox(logLevels[i]).checked = turnOn;",

          "					if (turnOn) {",

          "						addClass(logMainContainer, logLevels[i]);",

          "					} else {",

          "						removeClass(logMainContainer, logLevels[i]);",

          "					}",

          "				}",

          "			}",

          "",

          "			function checkAllLevels() {",

          "				for (var i = 0; i < logLevels.length; i++) {",

          "					if (!getCheckBox(logLevels[i]).checked) {",

          '						getCheckBox("ALL").checked = false;',

          "						return;",

          "					}",

          "				}",

          '				getCheckBox("ALL").checked = true;',

          "			}",

          "",

          "			function clearLog() {",

          "				rootGroup.clear();",

          "				currentGroup = rootGroup;",

          "				logEntries = [];",

          "				logItems = [];",

          "				logEntriesAndSeparators = [];",

          " 				doSearch();",

          "			}",

          "",

          "			function toggleWrap() {",

          '				var enable = $("wrap").checked;',

          "				if (enable) {",

          '					addClass(logMainContainer, "wrap");',

          "				} else {",

          '					removeClass(logMainContainer, "wrap");',

          "				}",

          "				refreshCurrentMatch();",

          "			}",

          "",

          "			/* ------------------------------------------------------------------- */",

          "",

          "			// Search",

          "",

          "			var searchTimer = null;",

          "",

          "			function scheduleSearch() {",

          "				try {",

          "					clearTimeout(searchTimer);",

          "				} catch (ex) {",

          "					// Do nothing",

          "				}",

          "				searchTimer = setTimeout(doSearch, 500);",

          "			}",

          "",

          "			function Search(searchTerm, isRegex, searchRegex, isCaseSensitive) {",

          "				this.searchTerm = searchTerm;",

          "				this.isRegex = isRegex;",

          "				this.searchRegex = searchRegex;",

          "				this.isCaseSensitive = isCaseSensitive;",

          "				this.matches = [];",

          "			}",

          "",

          "			Search.prototype = {",

          "				hasMatches: function() {",

          "					return this.matches.length > 0;",

          "				},",

          "",

          "				hasVisibleMatches: function() {",

          "					if (this.hasMatches()) {",

          "						for (var i = 0; i < this.matches.length; i++) {",

          "							if (this.matches[i].isVisible()) {",

          "								return true;",

          "							}",

          "						}",

          "					}",

          "					return false;",

          "				},",

          "",

          "				match: function(logEntry) {",

          "					var entryText = String(logEntry.formattedMessage);",

          "					var matchesSearch = false;",

          "					if (this.isRegex) {",

          "						matchesSearch = this.searchRegex.test(entryText);",

          "					} else if (this.isCaseSensitive) {",

          "						matchesSearch = (entryText.indexOf(this.searchTerm) > -1);",

          "					} else {",

          "						matchesSearch = (entryText.toLowerCase().indexOf(this.searchTerm.toLowerCase()) > -1);",

          "					}",

          "					return matchesSearch;",

          "				},",

          "",

          "				getNextVisibleMatchIndex: function() {",

          "					for (var i = currentMatchIndex + 1; i < this.matches.length; i++) {",

          "						if (this.matches[i].isVisible()) {",

          "							return i;",

          "						}",

          "					}",

          "					// Start again from the first match",

          "					for (i = 0; i <= currentMatchIndex; i++) {",

          "						if (this.matches[i].isVisible()) {",

          "							return i;",

          "						}",

          "					}",

          "					return -1;",

          "				},",

          "",

          "				getPreviousVisibleMatchIndex: function() {",

          "					for (var i = currentMatchIndex - 1; i >= 0; i--) {",

          "						if (this.matches[i].isVisible()) {",

          "							return i;",

          "						}",

          "					}",

          "					// Start again from the last match",

          "					for (var i = this.matches.length - 1; i >= currentMatchIndex; i--) {",

          "						if (this.matches[i].isVisible()) {",

          "							return i;",

          "						}",

          "					}",

          "					return -1;",

          "				},",

          "",

          "				applyTo: function(logEntry) {",

          "					var doesMatch = this.match(logEntry);",

          "					if (doesMatch) {",

          "						logEntry.group.expand();",

          "						logEntry.setSearchMatch(true);",

          "						var logEntryContent;",

          "						var wrappedLogEntryContent;",

          '						var searchTermReplacementStartTag = "<span class=\\"searchterm\\">";',

          '						var searchTermReplacementEndTag = "<" + "/span>";',

          '						var preTagName = isIe ? "pre" : "span";',

          '						var preStartTag = "<" + preTagName + " class=\\"pre\\">";',

          '						var preEndTag = "<" + "/" + preTagName + ">";',

          "						var startIndex = 0;",

          "						var searchIndex, matchedText, textBeforeMatch;",

          "						if (this.isRegex) {",

          '							var flags = this.isCaseSensitive ? "g" : "gi";',

          '							var capturingRegex = new RegExp("(" + this.searchRegex.source + ")", flags);',

          "",

          "							// Replace the search term with temporary tokens for the start and end tags",

          '							var rnd = ("" + Math.random()).substr(2);',

          '							var startToken = "%%s" + rnd + "%%";',

          '							var endToken = "%%e" + rnd + "%%";',

          '							logEntryContent = logEntry.formattedMessage.replace(capturingRegex, startToken + "$1" + endToken);',

          "",

          "							// Escape the HTML to get rid of angle brackets",

          "							logEntryContent = escapeHtml(logEntryContent);",

          "",

          "							// Substitute the proper HTML back in for the search match",

          "							var result;",

          "							var searchString = logEntryContent;",

          '							logEntryContent = "";',

          '							wrappedLogEntryContent = "";',

          "							while ((searchIndex = searchString.indexOf(startToken, startIndex)) > -1) {",

          "								var endTokenIndex = searchString.indexOf(endToken, searchIndex);",

          "								matchedText = searchString.substring(searchIndex + startToken.length, endTokenIndex);",

          "								textBeforeMatch = searchString.substring(startIndex, searchIndex);",

          "								logEntryContent += preStartTag + textBeforeMatch + preEndTag;",

          "								logEntryContent += searchTermReplacementStartTag + preStartTag + matchedText +",

          "									preEndTag + searchTermReplacementEndTag;",

          "								if (isIe) {",

          "									wrappedLogEntryContent += textBeforeMatch + searchTermReplacementStartTag +",

          "										matchedText + searchTermReplacementEndTag;",

          "								}",

          "								startIndex = endTokenIndex + endToken.length;",

          "							}",

          "							logEntryContent += preStartTag + searchString.substr(startIndex) + preEndTag;",

          "							if (isIe) {",

          "								wrappedLogEntryContent += searchString.substr(startIndex);",

          "							}",

          "						} else {",

          '							logEntryContent = "";',

          '							wrappedLogEntryContent = "";',

          "							var searchTermReplacementLength = searchTermReplacementStartTag.length +",

          "								this.searchTerm.length + searchTermReplacementEndTag.length;",

          "							var searchTermLength = this.searchTerm.length;",

          "							var searchTermLowerCase = this.searchTerm.toLowerCase();",

          "							var logTextLowerCase = logEntry.formattedMessage.toLowerCase();",

          "							while ((searchIndex = logTextLowerCase.indexOf(searchTermLowerCase, startIndex)) > -1) {",

          "								matchedText = escapeHtml(logEntry.formattedMessage.substr(searchIndex, this.searchTerm.length));",

          "								textBeforeMatch = escapeHtml(logEntry.formattedMessage.substring(startIndex, searchIndex));",

          "								var searchTermReplacement = searchTermReplacementStartTag +",

          "									preStartTag + matchedText + preEndTag + searchTermReplacementEndTag;",

          "								logEntryContent += preStartTag + textBeforeMatch + preEndTag + searchTermReplacement;",

          "								if (isIe) {",

          "									wrappedLogEntryContent += textBeforeMatch + searchTermReplacementStartTag +",

          "										matchedText + searchTermReplacementEndTag;",

          "								}",

          "								startIndex = searchIndex + searchTermLength;",

          "							}",

          "							var textAfterLastMatch = escapeHtml(logEntry.formattedMessage.substr(startIndex));",

          "							logEntryContent += preStartTag + textAfterLastMatch + preEndTag;",

          "							if (isIe) {",

          "								wrappedLogEntryContent += textAfterLastMatch;",

          "							}",

          "						}",

          "						logEntry.setContent(logEntryContent, wrappedLogEntryContent);",

          "						var logEntryMatches = logEntry.getSearchMatches();",

          "						this.matches = this.matches.concat(logEntryMatches);",

          "					} else {",

          "						logEntry.setSearchMatch(false);",

          "						logEntry.setContent(logEntry.formattedMessage, logEntry.formattedMessage);",

          "					}",

          "					return doesMatch;",

          "				},",

          "",

          "				removeMatches: function(logEntries) {",

          "					var matchesToRemoveCount = 0;",

          "					var currentMatchRemoved = false;",

          "					var matchesToRemove = [];",

          "					var i, iLen, j, jLen;",

          "",

          "					// Establish the list of matches to be removed",

          "					for (i = 0, iLen = this.matches.length; i < iLen; i++) {",

          "						for (j = 0, jLen = logEntries.length; j < jLen; j++) {",

          "							if (this.matches[i].belongsTo(logEntries[j])) {",

          "								matchesToRemove.push(this.matches[i]);",

          "								if (i === currentMatchIndex) {",

          "									currentMatchRemoved = true;",

          "								}",

          "							}",

          "						}",

          "					}",

          "",

          "					// Set the new current match index if the current match has been deleted",

          "					// This will be the first match that appears after the first log entry being",

          "					// deleted, if one exists; otherwise, it's the first match overall",

          "					var newMatch = currentMatchRemoved ? null : this.matches[currentMatchIndex];",

          "					if (currentMatchRemoved) {",

          "						for (i = currentMatchIndex, iLen = this.matches.length; i < iLen; i++) {",

          "							if (this.matches[i].isVisible() && !array_contains(matchesToRemove, this.matches[i])) {",

          "								newMatch = this.matches[i];",

          "								break;",

          "							}",

          "						}",

          "					}",

          "",

          "					// Remove the matches",

          "					for (i = 0, iLen = matchesToRemove.length; i < iLen; i++) {",

          "						array_remove(this.matches, matchesToRemove[i]);",

          "						matchesToRemove[i].remove();",

          "					}",

          "",

          "					// Set the new match, if one exists",

          "					if (this.hasVisibleMatches()) {",

          "						if (newMatch === null) {",

          "							setCurrentMatchIndex(0);",

          "						} else {",

          "							// Get the index of the new match",

          "							var newMatchIndex = 0;",

          "							for (i = 0, iLen = this.matches.length; i < iLen; i++) {",

          "								if (newMatch === this.matches[i]) {",

          "									newMatchIndex = i;",

          "									break;",

          "								}",

          "							}",

          "							setCurrentMatchIndex(newMatchIndex);",

          "						}",

          "					} else {",

          "						currentMatchIndex = null;",

          "						displayNoMatches();",

          "					}",

          "				}",

          "			};",

          "",

          "			function getPageOffsetTop(el, container) {",

          "				var currentEl = el;",

          "				var y = 0;",

          "				while (currentEl && currentEl != container) {",

          "					y += currentEl.offsetTop;",

          "					currentEl = currentEl.offsetParent;",

          "				}",

          "				return y;",

          "			}",

          "",

          "			function scrollIntoView(el) {",

          "				var logContainer = logMainContainer;",

          "				// Check if the whole width of the element is visible and centre if not",

          '				if (!$("wrap").checked) {',

          "					var logContainerLeft = logContainer.scrollLeft;",

          "					var logContainerRight = logContainerLeft  + logContainer.offsetWidth;",

          "					var elLeft = el.offsetLeft;",

          "					var elRight = elLeft + el.offsetWidth;",

          "					if (elLeft < logContainerLeft || elRight > logContainerRight) {",

          "						logContainer.scrollLeft = elLeft - (logContainer.offsetWidth - el.offsetWidth) / 2;",

          "					}",

          "				}",

          "				// Check if the whole height of the element is visible and centre if not",

          "				var logContainerTop = logContainer.scrollTop;",

          "				var logContainerBottom = logContainerTop  + logContainer.offsetHeight;",

          "				var elTop = getPageOffsetTop(el) - getToolBarsHeight();",

          "				var elBottom = elTop + el.offsetHeight;",

          "				if (elTop < logContainerTop || elBottom > logContainerBottom) {",

          "					logContainer.scrollTop = elTop - (logContainer.offsetHeight - el.offsetHeight) / 2;",

          "				}",

          "			}",

          "",

          "			function Match(logEntryLevel, spanInMainDiv, spanInUnwrappedPre, spanInWrappedDiv) {",

          "				this.logEntryLevel = logEntryLevel;",

          "				this.spanInMainDiv = spanInMainDiv;",

          "				if (isIe) {",

          "					this.spanInUnwrappedPre = spanInUnwrappedPre;",

          "					this.spanInWrappedDiv = spanInWrappedDiv;",

          "				}",

          "				this.mainSpan = isIe ? spanInUnwrappedPre : spanInMainDiv;",

          "			}",

          "",

          "			Match.prototype = {",

          "				equals: function(match) {",

          "					return this.mainSpan === match.mainSpan;",

          "				},",

          "",

          "				setCurrent: function() {",

          "					if (isIe) {",

          '						addClass(this.spanInUnwrappedPre, "currentmatch");',

          '						addClass(this.spanInWrappedDiv, "currentmatch");',

          "						// Scroll the visible one into view",

          '						var elementToScroll = $("wrap").checked ? this.spanInWrappedDiv : this.spanInUnwrappedPre;',

          "						scrollIntoView(elementToScroll);",

          "					} else {",

          '						addClass(this.spanInMainDiv, "currentmatch");',

          "						scrollIntoView(this.spanInMainDiv);",

          "					}",

          "				},",

          "",

          "				belongsTo: function(logEntry) {",

          "					if (isIe) {",

          "						return isDescendant(this.spanInUnwrappedPre, logEntry.unwrappedPre);",

          "					} else {",

          "						return isDescendant(this.spanInMainDiv, logEntry.mainDiv);",

          "					}",

          "				},",

          "",

          "				setNotCurrent: function() {",

          "					if (isIe) {",

          '						removeClass(this.spanInUnwrappedPre, "currentmatch");',

          '						removeClass(this.spanInWrappedDiv, "currentmatch");',

          "					} else {",

          '						removeClass(this.spanInMainDiv, "currentmatch");',

          "					}",

          "				},",

          "",

          "				isOrphan: function() {",

          "					return isOrphan(this.mainSpan);",

          "				},",

          "",

          "				isVisible: function() {",

          "					return getCheckBox(this.logEntryLevel).checked;",

          "				},",

          "",

          "				remove: function() {",

          "					if (isIe) {",

          "						this.spanInUnwrappedPre = null;",

          "						this.spanInWrappedDiv = null;",

          "					} else {",

          "						this.spanInMainDiv = null;",

          "					}",

          "				}",

          "			};",

          "",

          "			var currentSearch = null;",

          "			var currentMatchIndex = null;",

          "",

          "			function doSearch() {",

          '				var searchBox = $("searchBox");',

          "				var searchTerm = searchBox.value;",

          '				var isRegex = $("searchRegex").checked;',

          '				var isCaseSensitive = $("searchCaseSensitive").checked;',

          "				var i;",

          "",

          '				if (searchTerm === "") {',

          '					$("searchReset").disabled = true;',

          '					$("searchNav").style.display = "none";',

          '					removeClass(document.body, "searching");',

          '					removeClass(searchBox, "hasmatches");',

          '					removeClass(searchBox, "nomatches");',

          "					for (i = 0; i < logEntries.length; i++) {",

          "						logEntries[i].clearSearch();",

          "						logEntries[i].setContent(logEntries[i].formattedMessage, logEntries[i].formattedMessage);",

          "					}",

          "					currentSearch = null;",

          "					setLogContainerHeight();",

          "				} else {",

          '					$("searchReset").disabled = false;',

          '					$("searchNav").style.display = "block";',

          "					var searchRegex;",

          "					var regexValid;",

          "					if (isRegex) {",

          "						try {",

          '							searchRegex = isCaseSensitive ? new RegExp(searchTerm, "g") : new RegExp(searchTerm, "gi");',

          "							regexValid = true;",

          '							replaceClass(searchBox, "validregex", "invalidregex");',

          '							searchBox.title = "Valid regex";',

          "						} catch (ex) {",

          "							regexValid = false;",

          '							replaceClass(searchBox, "invalidregex", "validregex");',

          '							searchBox.title = "Invalid regex: " + (ex.message ? ex.message : (ex.description ? ex.description : "unknown error"));',

          "							return;",

          "						}",

          "					} else {",

          '						searchBox.title = "";',

          '						removeClass(searchBox, "validregex");',

          '						removeClass(searchBox, "invalidregex");',

          "					}",

          '					addClass(document.body, "searching");',

          "					currentSearch = new Search(searchTerm, isRegex, searchRegex, isCaseSensitive);",

          "					for (i = 0; i < logEntries.length; i++) {",

          "						currentSearch.applyTo(logEntries[i]);",

          "					}",

          "					setLogContainerHeight();",

          "",

          "					// Highlight the first search match",

          "					if (currentSearch.hasVisibleMatches()) {",

          "						setCurrentMatchIndex(0);",

          "						displayMatches();",

          "					} else {",

          "						displayNoMatches();",

          "					}",

          "				}",

          "			}",

          "",

          "			function updateSearchFromFilters() {",

          "				if (currentSearch) {",

          "					if (currentSearch.hasMatches()) {",

          "						if (currentMatchIndex === null) {",

          "							currentMatchIndex = 0;",

          "						}",

          "						var currentMatch = currentSearch.matches[currentMatchIndex];",

          "						if (currentMatch.isVisible()) {",

          "							displayMatches();",

          "							setCurrentMatchIndex(currentMatchIndex);",

          "						} else {",

          "							currentMatch.setNotCurrent();",

          "							// Find the next visible match, if one exists",

          "							var nextVisibleMatchIndex = currentSearch.getNextVisibleMatchIndex();",

          "							if (nextVisibleMatchIndex > -1) {",

          "								setCurrentMatchIndex(nextVisibleMatchIndex);",

          "								displayMatches();",

          "							} else {",

          "								displayNoMatches();",

          "							}",

          "						}",

          "					} else {",

          "						displayNoMatches();",

          "					}",

          "				}",

          "			}",

          "",

          "			function refreshCurrentMatch() {",

          "				if (currentSearch && currentSearch.hasVisibleMatches()) {",

          "					setCurrentMatchIndex(currentMatchIndex);",

          "				}",

          "			}",

          "",

          "			function displayMatches() {",

          '				replaceClass($("searchBox"), "hasmatches", "nomatches");',

          '				$("searchBox").title = "" + currentSearch.matches.length + " matches found";',

          '				$("searchNav").style.display = "block";',

          "				setLogContainerHeight();",

          "			}",

          "",

          "			function displayNoMatches() {",

          '				replaceClass($("searchBox"), "nomatches", "hasmatches");',

          '				$("searchBox").title = "No matches found";',

          '				$("searchNav").style.display = "none";',

          "				setLogContainerHeight();",

          "			}",

          "",

          "			function toggleSearchEnabled(enable) {",

          '				enable = (typeof enable == "undefined") ? !$("searchDisable").checked : enable;',

          '				$("searchBox").disabled = !enable;',

          '				$("searchReset").disabled = !enable;',

          '				$("searchRegex").disabled = !enable;',

          '				$("searchNext").disabled = !enable;',

          '				$("searchPrevious").disabled = !enable;',

          '				$("searchCaseSensitive").disabled = !enable;',

          '				$("searchNav").style.display = (enable && ($("searchBox").value !== "") &&',

          "						currentSearch && currentSearch.hasVisibleMatches()) ?",

          '					"block" : "none";',

          "				if (enable) {",

          '					removeClass($("search"), "greyedout");',

          '					addClass(document.body, "searching");',

          '					if ($("searchHighlight").checked) {',

          '						addClass(logMainContainer, "searchhighlight");',

          "					} else {",

          '						removeClass(logMainContainer, "searchhighlight");',

          "					}",

          '					if ($("searchFilter").checked) {',

          '						addClass(logMainContainer, "searchfilter");',

          "					} else {",

          '						removeClass(logMainContainer, "searchfilter");',

          "					}",

          '					$("searchDisable").checked = !enable;',

          "				} else {",

          '					addClass($("search"), "greyedout");',

          '					removeClass(document.body, "searching");',

          '					removeClass(logMainContainer, "searchhighlight");',

          '					removeClass(logMainContainer, "searchfilter");',

          "				}",

          "				setLogContainerHeight();",

          "			}",

          "",

          "			function toggleSearchFilter() {",

          '				var enable = $("searchFilter").checked;',

          "				if (enable) {",

          '					addClass(logMainContainer, "searchfilter");',

          "				} else {",

          '					removeClass(logMainContainer, "searchfilter");',

          "				}",

          "				refreshCurrentMatch();",

          "			}",

          "",

          "			function toggleSearchHighlight() {",

          '				var enable = $("searchHighlight").checked;',

          "				if (enable) {",

          '					addClass(logMainContainer, "searchhighlight");',

          "				} else {",

          '					removeClass(logMainContainer, "searchhighlight");',

          "				}",

          "			}",

          "",

          "			function clearSearch() {",

          '				$("searchBox").value = "";',

          "				doSearch();",

          "			}",

          "",

          "			function searchNext() {",

          "				if (currentSearch !== null && currentMatchIndex !== null) {",

          "					currentSearch.matches[currentMatchIndex].setNotCurrent();",

          "					var nextMatchIndex = currentSearch.getNextVisibleMatchIndex();",

          '					if (nextMatchIndex > currentMatchIndex || confirm("Reached the end of the page. Start from the top?")) {',

          "						setCurrentMatchIndex(nextMatchIndex);",

          "					}",

          "				}",

          "			}",

          "",

          "			function searchPrevious() {",

          "				if (currentSearch !== null && currentMatchIndex !== null) {",

          "					currentSearch.matches[currentMatchIndex].setNotCurrent();",

          "					var previousMatchIndex = currentSearch.getPreviousVisibleMatchIndex();",

          '					if (previousMatchIndex < currentMatchIndex || confirm("Reached the start of the page. Continue from the bottom?")) {',

          "						setCurrentMatchIndex(previousMatchIndex);",

          "					}",

          "				}",

          "			}",

          "",

          "			function setCurrentMatchIndex(index) {",

          "				currentMatchIndex = index;",

          "				currentSearch.matches[currentMatchIndex].setCurrent();",

          "			}",

          "",

          "			/* ------------------------------------------------------------------------- */",

          "",

          "			// CSS Utilities",

          "",

          "			function addClass(el, cssClass) {",

          "				if (!hasClass(el, cssClass)) {",

          "					if (el.className) {",

          '						el.className += " " + cssClass;',

          "					} else {",

          "						el.className = cssClass;",

          "					}",

          "				}",

          "			}",

          "",

          "			function hasClass(el, cssClass) {",

          "				if (el.className) {",

          '					var classNames = el.className.split(" ");',

          "					return array_contains(classNames, cssClass);",

          "				}",

          "				return false;",

          "			}",

          "",

          "			function removeClass(el, cssClass) {",

          "				if (hasClass(el, cssClass)) {",

          "					// Rebuild the className property",

          '					var existingClasses = el.className.split(" ");',

          "					var newClasses = [];",

          "					for (var i = 0, len = existingClasses.length; i < len; i++) {",

          "						if (existingClasses[i] != cssClass) {",

          "							newClasses[newClasses.length] = existingClasses[i];",

          "						}",

          "					}",

          '					el.className = newClasses.join(" ");',

          "				}",

          "			}",

          "",

          "			function replaceClass(el, newCssClass, oldCssClass) {",

          "				removeClass(el, oldCssClass);",

          "				addClass(el, newCssClass);",

          "			}",

          "",

          "			/* ------------------------------------------------------------------------- */",

          "",

          "			// Other utility functions",

          "",

          "			function getElementsByClass(el, cssClass, tagName) {",

          "				var elements = el.getElementsByTagName(tagName);",

          "				var matches = [];",

          "				for (var i = 0, len = elements.length; i < len; i++) {",

          "					if (hasClass(elements[i], cssClass)) {",

          "						matches.push(elements[i]);",

          "					}",

          "				}",

          "				return matches;",

          "			}",

          "",

          "			// Syntax borrowed from Prototype library",

          "			function $(id) {",

          "				return document.getElementById(id);",

          "			}",

          "",

          "			function isDescendant(node, ancestorNode) {",

          "				while (node != null) {",

          "					if (node === ancestorNode) {",

          "						return true;",

          "					}",

          "					node = node.parentNode;",

          "				}",

          "				return false;",

          "			}",

          "",

          "			function isOrphan(node) {",

          "				var currentNode = node;",

          "				while (currentNode) {",

          "					if (currentNode == document.body) {",

          "						return false;",

          "					}",

          "					currentNode = currentNode.parentNode;",

          "				}",

          "				return true;",

          "			}",

          "",

          "			function escapeHtml(str) {",

          '				return str.replace(/&/g, "&amp;").replace(/[<]/g, "&lt;").replace(/>/g, "&gt;");',

          "			}",

          "",

          "			function getWindowWidth() {",

          "				if (window.innerWidth) {",

          "					return window.innerWidth;",

          "				} else if (document.documentElement && document.documentElement.clientWidth) {",

          "					return document.documentElement.clientWidth;",

          "				} else if (document.body) {",

          "					return document.body.clientWidth;",

          "				}",

          "				return 0;",

          "			}",

          "",

          "			function getWindowHeight() {",

          "				if (window.innerHeight) {",

          "					return window.innerHeight;",

          "				} else if (document.documentElement && document.documentElement.clientHeight) {",

          "					return document.documentElement.clientHeight;",

          "				} else if (document.body) {",

          "					return document.body.clientHeight;",

          "				}",

          "				return 0;",

          "			}",

          "",

          "			function getToolBarsHeight() {",

          '				return $("switches").offsetHeight;',

          "			}",

          "",

          "			function getChromeHeight() {",

          "				var height = getToolBarsHeight();",

          "				if (showCommandLine) {",

          '					height += $("commandLine").offsetHeight;',

          "				}",

          "				return height;",

          "			}",

          "",

          "			function setLogContainerHeight() {",

          "				if (logMainContainer) {",

          "					var windowHeight = getWindowHeight();",

          '					$("body").style.height = getWindowHeight() + "px";',

          '					logMainContainer.style.height = "" +',

          '						Math.max(0, windowHeight - getChromeHeight()) + "px";',

          "				}",

          "			}",

          "",

          "			function setCommandInputWidth() {",

          "				if (showCommandLine) {",

          '					$("command").style.width = "" + Math.max(0, $("commandLineContainer").offsetWidth -',

          '						($("evaluateButton").offsetWidth + 13)) + "px";',

          "				}",

          "			}",

          "",

          "			window.onresize = function() {",

          "				setCommandInputWidth();",

          "				setLogContainerHeight();",

          "			};",

          "",

          "			if (!Array.prototype.push) {",

          "				Array.prototype.push = function() {",

          "					for (var i = 0, len = arguments.length; i < len; i++){",

          "						this[this.length] = arguments[i];",

          "					}",

          "					return this.length;",

          "				};",

          "			}",

          "",

          "			if (!Array.prototype.pop) {",

          "				Array.prototype.pop = function() {",

          "					if (this.length > 0) {",

          "						var val = this[this.length - 1];",

          "						this.length = this.length - 1;",

          "						return val;",

          "					}",

          "				};",

          "			}",

          "",

          "			if (!Array.prototype.shift) {",

          "				Array.prototype.shift = function() {",

          "					if (this.length > 0) {",

          "						var firstItem = this[0];",

          "						for (var i = 0, len = this.length - 1; i < len; i++) {",

          "							this[i] = this[i + 1];",

          "						}",

          "						this.length = this.length - 1;",

          "						return firstItem;",

          "					}",

          "				};",

          "			}",

          "",

          "			if (!Array.prototype.splice) {",

          "				Array.prototype.splice = function(startIndex, deleteCount) {",

          "					var itemsAfterDeleted = this.slice(startIndex + deleteCount);",

          "					var itemsDeleted = this.slice(startIndex, startIndex + deleteCount);",

          "					this.length = startIndex;",

          "					// Copy the arguments into a proper Array object",

          "					var argumentsArray = [];",

          "					for (var i = 0, len = arguments.length; i < len; i++) {",

          "						argumentsArray[i] = arguments[i];",

          "					}",

          "					var itemsToAppend = (argumentsArray.length > 2) ?",

          "						itemsAfterDeleted = argumentsArray.slice(2).concat(itemsAfterDeleted) : itemsAfterDeleted;",

          "					for (i = 0, len = itemsToAppend.length; i < len; i++) {",

          "						this.push(itemsToAppend[i]);",

          "					}",

          "					return itemsDeleted;",

          "				};",

          "			}",

          "",

          "			function array_remove(arr, val) {",

          "				var index = -1;",

          "				for (var i = 0, len = arr.length; i < len; i++) {",

          "					if (arr[i] === val) {",

          "						index = i;",

          "						break;",

          "					}",

          "				}",

          "				if (index >= 0) {",

          "					arr.splice(index, 1);",

          "					return index;",

          "				} else {",

          "					return false;",

          "				}",

          "			}",

          "",

          "			function array_removeFromStart(array, numberToRemove) {",

          "				if (Array.prototype.splice) {",

          "					array.splice(0, numberToRemove);",

          "				} else {",

          "					for (var i = numberToRemove, len = array.length; i < len; i++) {",

          "						array[i - numberToRemove] = array[i];",

          "					}",

          "					array.length = array.length - numberToRemove;",

          "				}",

          "				return array;",

          "			}",

          "",

          "			function array_contains(arr, val) {",

          "				for (var i = 0, len = arr.length; i < len; i++) {",

          "					if (arr[i] == val) {",

          "						return true;",

          "					}",

          "				}",

          "				return false;",

          "			}",

          "",

          "			function getErrorMessage(ex) {",

          "				if (ex.message) {",

          "					return ex.message;",

          "				} else if (ex.description) {",

          "					return ex.description;",

          "				}",

          '				return "" + ex;',

          "			}",

          "",

          "			function moveCaretToEnd(input) {",

          "				if (input.setSelectionRange) {",

          "					input.focus();",

          "					var length = input.value.length;",

          "					input.setSelectionRange(length, length);",

          "				} else if (input.createTextRange) {",

          "					var range = input.createTextRange();",

          "					range.collapse(false);",

          "					range.select();",

          "				}",

          "				input.focus();",

          "			}",

          "",

          "			function stopPropagation(evt) {",

          "				if (evt.stopPropagation) {",

          "					evt.stopPropagation();",

          '				} else if (typeof evt.cancelBubble != "undefined") {',

          "					evt.cancelBubble = true;",

          "				}",

          "			}",

          "",

          "			function getEvent(evt) {",

          "				return evt ? evt : event;",

          "			}",

          "",

          "			function getTarget(evt) {",

          "				return evt.target ? evt.target : evt.srcElement;",

          "			}",

          "",

          "			function getRelatedTarget(evt) {",

          "				if (evt.relatedTarget) {",

          "					return evt.relatedTarget;",

          "				} else if (evt.srcElement) {",

          "					switch(evt.type) {",

          '						case "mouseover":',

          "							return evt.fromElement;",

          '						case "mouseout":',

          "							return evt.toElement;",

          "						default:",

          "							return evt.srcElement;",

          "					}",

          "				}",

          "			}",

          "",

          "			function cancelKeyEvent(evt) {",

          "				evt.returnValue = false;",

          "				stopPropagation(evt);",

          "			}",

          "",

          "			function evalCommandLine() {",

          '				var expr = $("command").value;',

          "				evalCommand(expr);",

          '				$("command").value = "";',

          "			}",

          "",

          "			function evalLastCommand() {",

          "				if (lastCommand != null) {",

          "					evalCommand(lastCommand);",

          "				}",

          "			}",

          "",

          "			var lastCommand = null;",

          "			var commandHistory = [];",

          "			var currentCommandIndex = 0;",

          "",

          "			function evalCommand(expr) {",

          "				if (appender) {",

          "					appender.evalCommandAndAppend(expr);",

          "				} else {",

          '					var prefix = ">>> " + expr + "\\r\\n";',

          "					try {",

          '						log("INFO", prefix + eval(expr));',

          "					} catch (ex) {",

          '						log("ERROR", prefix + "Error: " + getErrorMessage(ex));',

          "					}",

          "				}",

          "				// Update command history",

          "				if (expr != commandHistory[commandHistory.length - 1]) {",

          "					commandHistory.push(expr);",

          "					// Update the appender",

          "					if (appender) {",

          "						appender.storeCommandHistory(commandHistory);",

          "					}",

          "				}",

          "				currentCommandIndex = (expr == commandHistory[currentCommandIndex]) ? currentCommandIndex + 1 : commandHistory.length;",

          "				lastCommand = expr;",

          "			}",

          "			//]]>",

          "		</script>",

          '		<style type="text/css">',

          "			body {",

          "				background-color: white;",

          "				color: black;",

          "				padding: 0;",

          "				margin: 0;",

          "				font-family: tahoma, verdana, arial, helvetica, sans-serif;",

          "				overflow: hidden;",

          "			}",

          "",

          "			div#switchesContainer input {",

          "				margin-bottom: 0;",

          "			}",

          "",

          "			div.toolbar {",

          "				border-top: solid #ffffff 1px;",

          "				border-bottom: solid #aca899 1px;",

          "				background-color: #f1efe7;",

          "				padding: 3px 5px;",

          "				font-size: 68.75%;",

          "			}",

          "",

          "			div.toolbar, div#search input {",

          "				font-family: tahoma, verdana, arial, helvetica, sans-serif;",

          "			}",

          "",

          "			div.toolbar input.button {",

          "				padding: 0 5px;",

          "				font-size: 100%;",

          "			}",

          "",

          "			div.toolbar input.hidden {",

          "				display: none;",

          "			}",

          "",

          "			div#switches input#clearButton {",

          "				margin-left: 20px;",

          "			}",

          "",

          "			div#levels label {",

          "				font-weight: bold;",

          "			}",

          "",

          "			div#levels label, div#options label {",

          "				margin-right: 5px;",

          "			}",

          "",

          "			div#levels label#wrapLabel {",

          "				font-weight: normal;",

          "			}",

          "",

          "			div#search label {",

          "				margin-right: 10px;",

          "			}",

          "",

          "			div#search label.searchboxlabel {",

          "				margin-right: 0;",

          "			}",

          "",

          "			div#search input {",

          "				font-size: 100%;",

          "			}",

          "",

          "			div#search input.validregex {",

          "				color: green;",

          "			}",

          "",

          "			div#search input.invalidregex {",

          "				color: red;",

          "			}",

          "",

          "			div#search input.nomatches {",

          "				color: white;",

          "				background-color: #ff6666;",

          "			}",

          "",

          "			div#search input.nomatches {",

          "				color: white;",

          "				background-color: #ff6666;",

          "			}",

          "",

          "			div#searchNav {",

          "				display: none;",

          "			}",

          "",

          "			div#commandLine {",

          "				display: none;",

          "			}",

          "",

          "			div#commandLine input#command {",

          "				font-size: 100%;",

          "				font-family: Courier New, Courier;",

          "			}",

          "",

          "			div#commandLine input#evaluateButton {",

          "			}",

          "",

          "			*.greyedout {",

          "				color: gray !important;",

          "				border-color: gray !important;",

          "			}",

          "",

          "			*.greyedout *.alwaysenabled { color: black; }",

          "",

          "			*.unselectable {",

          "				-khtml-user-select: none;",

          "				-moz-user-select: none;",

          "				user-select: none;",

          "			}",

          "",

          "			div#log {",

          "				font-family: Courier New, Courier;",

          "				font-size: 75%;",

          "				width: 100%;",

          "				overflow: auto;",

          "				clear: both;",

          "				position: relative;",

          "			}",

          "",

          "			div.group {",

          "				border-color: #cccccc;",

          "				border-style: solid;",

          "				border-width: 1px 0 1px 1px;",

          "				overflow: visible;",

          "			}",

          "",

          "			div.oldIe div.group, div.oldIe div.group *, div.oldIe *.logentry {",

          "				height: 1%;",

          "			}",

          "",

          "			div.group div.groupheading span.expander {",

          "				border: solid black 1px;",

          "				font-family: Courier New, Courier;",

          "				font-size: 0.833em;",

          "				background-color: #eeeeee;",

          "				position: relative;",

          "				top: -1px;",

          "				color: black;",

          "				padding: 0 2px;",

          "				cursor: pointer;",

          "				cursor: hand;",

          "				height: 1%;",

          "			}",

          "",

          "			div.group div.groupcontent {",

          "				margin-left: 10px;",

          "				padding-bottom: 2px;",

          "				overflow: visible;",

          "			}",

          "",

          "			div.group div.expanded {",

          "				display: block;",

          "			}",

          "",

          "			div.group div.collapsed {",

          "				display: none;",

          "			}",

          "",

          "			*.logentry {",

          "				overflow: visible;",

          "				display: none;",

          "				white-space: pre;",

          "			}",

          "",

          "			span.pre {",

          "				white-space: pre;",

          "			}",

          "",

          "			pre.unwrapped {",

          "				display: inline !important;",

          "			}",

          "",

          "			pre.unwrapped pre.pre, div.wrapped pre.pre {",

          "				display: inline;",

          "			}",

          "",

          "			div.wrapped pre.pre {",

          "				white-space: normal;",

          "			}",

          "",

          "			div.wrapped {",

          "				display: none;",

          "			}",

          "",

          "			body.searching *.logentry span.currentmatch {",

          "				color: white !important;",

          "				background-color: green !important;",

          "			}",

          "",

          "			body.searching div.searchhighlight *.logentry span.searchterm {",

          "				color: black;",

          "				background-color: yellow;",

          "			}",

          "",

          "			div.wrap *.logentry {",

          "				white-space: normal !important;",

          "				border-width: 0 0 1px 0;",

          "				border-color: #dddddd;",

          "				border-style: dotted;",

          "			}",

          "",

          "			div.wrap #log_wrapped, #log_unwrapped {",

          "				display: block;",

          "			}",

          "",

          "			div.wrap #log_unwrapped, #log_wrapped {",

          "				display: none;",

          "			}",

          "",

          "			div.wrap *.logentry span.pre {",

          "				overflow: visible;",

          "				white-space: normal;",

          "			}",

          "",

          "			div.wrap *.logentry pre.unwrapped {",

          "				display: none;",

          "			}",

          "",

          "			div.wrap *.logentry span.wrapped {",

          "				display: inline;",

          "			}",

          "",

          "			div.searchfilter *.searchnonmatch {",

          "				display: none !important;",

          "			}",

          "",

          "			div#log *.TRACE, label#label_TRACE {",

          "				color: #666666;",

          "			}",

          "",

          "			div#log *.DEBUG, label#label_DEBUG {",

          "				color: green;",

          "			}",

          "",

          "			div#log *.INFO, label#label_INFO {",

          "				color: #000099;",

          "			}",

          "",

          "			div#log *.WARN, label#label_WARN {",

          "				color: #999900;",

          "			}",

          "",

          "			div#log *.ERROR, label#label_ERROR {",

          "				color: red;",

          "			}",

          "",

          "			div#log *.FATAL, label#label_FATAL {",

          "				color: #660066;",

          "			}",

          "",

          "			div.TRACE#log *.TRACE,",

          "			div.DEBUG#log *.DEBUG,",

          "			div.INFO#log *.INFO,",

          "			div.WARN#log *.WARN,",

          "			div.ERROR#log *.ERROR,",

          "			div.FATAL#log *.FATAL {",

          "				display: block;",

          "			}",

          "",

          "			div#log div.separator {",

          "				background-color: #cccccc;",

          "				margin: 5px 0;",

          "				line-height: 1px;",

          "			}",

          "		</style>",

          "	</head>",

          "",

          '	<body id="body">',

          '		<div id="switchesContainer">',

          '			<div id="switches">',

          '				<div id="levels" class="toolbar">',

          "					Filters:",

          '					<input type="checkbox" id="switch_TRACE" onclick="applyFilters(); checkAllLevels()" checked="checked" title="Show/hide trace messages" /><label for="switch_TRACE" id="label_TRACE">trace</label>',

          '					<input type="checkbox" id="switch_DEBUG" onclick="applyFilters(); checkAllLevels()" checked="checked" title="Show/hide debug messages" /><label for="switch_DEBUG" id="label_DEBUG">debug</label>',

          '					<input type="checkbox" id="switch_INFO" onclick="applyFilters(); checkAllLevels()" checked="checked" title="Show/hide info messages" /><label for="switch_INFO" id="label_INFO">info</label>',

          '					<input type="checkbox" id="switch_WARN" onclick="applyFilters(); checkAllLevels()" checked="checked" title="Show/hide warn messages" /><label for="switch_WARN" id="label_WARN">warn</label>',

          '					<input type="checkbox" id="switch_ERROR" onclick="applyFilters(); checkAllLevels()" checked="checked" title="Show/hide error messages" /><label for="switch_ERROR" id="label_ERROR">error</label>',

          '					<input type="checkbox" id="switch_FATAL" onclick="applyFilters(); checkAllLevels()" checked="checked" title="Show/hide fatal messages" /><label for="switch_FATAL" id="label_FATAL">fatal</label>',

          '					<input type="checkbox" id="switch_ALL" onclick="toggleAllLevels(); applyFilters()" checked="checked" title="Show/hide all messages" /><label for="switch_ALL" id="label_ALL">all</label>',

          "				</div>",

          '				<div id="search" class="toolbar">',

          '					<label for="searchBox" class="searchboxlabel">Search:</label> <input type="text" id="searchBox" onclick="toggleSearchEnabled(true)" onkeyup="scheduleSearch()" size="20" />',

          '					<input type="button" id="searchReset" disabled="disabled" value="Reset" onclick="clearSearch()" class="button" title="Reset the search" />',

          '					<input type="checkbox" id="searchRegex" onclick="doSearch()" title="If checked, search is treated as a regular expression" /><label for="searchRegex">Regex</label>',

          '					<input type="checkbox" id="searchCaseSensitive" onclick="doSearch()" title="If checked, search is case sensitive" /><label for="searchCaseSensitive">Match case</label>',

          '					<input type="checkbox" id="searchDisable" onclick="toggleSearchEnabled()" title="Enable/disable search" /><label for="searchDisable" class="alwaysenabled">Disable</label>',

          '					<div id="searchNav">',

          '						<input type="button" id="searchNext" disabled="disabled" value="Next" onclick="searchNext()" class="button" title="Go to the next matching log entry" />',

          '						<input type="button" id="searchPrevious" disabled="disabled" value="Previous" onclick="searchPrevious()" class="button" title="Go to the previous matching log entry" />',

          '						<input type="checkbox" id="searchFilter" onclick="toggleSearchFilter()" title="If checked, non-matching log entries are filtered out" /><label for="searchFilter">Filter</label>',

          '						<input type="checkbox" id="searchHighlight" onclick="toggleSearchHighlight()" title="Highlight matched search terms" /><label for="searchHighlight" class="alwaysenabled">Highlight all</label>',

          "					</div>",

          "				</div>",

          '				<div id="options" class="toolbar">',

          "					Options:",

          '					<input type="checkbox" id="enableLogging" onclick="toggleLoggingEnabled()" checked="checked" title="Enable/disable logging" /><label for="enableLogging" id="enableLoggingLabel">Log</label>',

          '					<input type="checkbox" id="wrap" onclick="toggleWrap()" title="Enable / disable word wrap" /><label for="wrap" id="wrapLabel">Wrap</label>',

          '					<input type="checkbox" id="newestAtTop" onclick="toggleNewestAtTop()" title="If checked, causes newest messages to appear at the top" /><label for="newestAtTop" id="newestAtTopLabel">Newest at the top</label>',

          '					<input type="checkbox" id="scrollToLatest" onclick="toggleScrollToLatest()" checked="checked" title="If checked, window automatically scrolls to a new message when it is added" /><label for="scrollToLatest" id="scrollToLatestLabel">Scroll to latest</label>',

          '					<input type="button" id="clearButton" value="Clear" onclick="clearLog()" class="button" title="Clear all log messages"  />',

          '					<input type="button" id="hideButton" value="Hide" onclick="hide()" class="hidden button" title="Hide the console" />',

          '					<input type="button" id="closeButton" value="Close" onclick="closeWindow()" class="hidden button" title="Close the window" />',

          "				</div>",

          "			</div>",

          "		</div>",

          '		<div id="log" class="TRACE DEBUG INFO WARN ERROR FATAL"></div>',

          '		<div id="commandLine" class="toolbar">',

          '			<div id="commandLineContainer">',

          '				<input type="text" id="command" title="Enter a JavaScript command here and hit return or press \'Evaluate\'" />',

          '				<input type="button" id="evaluateButton" value="Evaluate" class="button" title="Evaluate the command" onclick="evalCommandLine()" />',

          "			</div>",

          "		</div>",

          "	</body>",

          "</html>",

          "",
        ];
      };

      var defaultCommandLineFunctions = [];

      ConsoleAppender = function () {};

      var consoleAppenderIdCounter = 1;

      ConsoleAppender.prototype = new Appender();

      ConsoleAppender.prototype.create = function (
        inPage,
        container,

        lazyInit,
        initiallyMinimized,
        useDocumentWrite,
        width,
        height,
        focusConsoleWindow
      ) {
        var appender = this;

        // Common properties

        var initialized = false;

        var consoleWindowCreated = false;

        var consoleWindowLoaded = false;

        var consoleClosed = false;

        var queuedLoggingEvents = [];

        var isSupported = true;

        var consoleAppenderId = consoleAppenderIdCounter++;

        // Local variables

        initiallyMinimized = extractBooleanFromParam(
          initiallyMinimized,
          this.defaults.initiallyMinimized
        );

        lazyInit = extractBooleanFromParam(lazyInit, this.defaults.lazyInit);

        useDocumentWrite = extractBooleanFromParam(
          useDocumentWrite,
          this.defaults.useDocumentWrite
        );

        var newestMessageAtTop = this.defaults.newestMessageAtTop;

        var scrollToLatestMessage = this.defaults.scrollToLatestMessage;

        width = width ? width : this.defaults.width;

        height = height ? height : this.defaults.height;

        var maxMessages = this.defaults.maxMessages;

        var showCommandLine = this.defaults.showCommandLine;

        var commandLineObjectExpansionDepth =
          this.defaults.commandLineObjectExpansionDepth;

        var showHideButton = this.defaults.showHideButton;

        var showCloseButton = this.defaults.showCloseButton;

        this.setLayout(this.defaults.layout);

        // Functions whose implementations vary between subclasses

        var init, createWindow, safeToAppend, getConsoleWindow, open;

        // Configuration methods. The function scope is used to prevent

        // direct alteration to the appender configuration properties.

        var appenderName = inPage ? "InPageAppender" : "PopUpAppender";

        var checkCanConfigure = function (configOptionName) {
          if (consoleWindowCreated) {
            handleError(
              appenderName +
                ": configuration option '" +
                configOptionName +
                "' may not be set after the appender has been initialized"
            );

            return false;
          }

          return true;
        };

        var consoleWindowExists = function () {
          return consoleWindowLoaded && isSupported && !consoleClosed;
        };

        this.isNewestMessageAtTop = function () {
          return newestMessageAtTop;
        };

        this.setNewestMessageAtTop = function (newestMessageAtTopParam) {
          newestMessageAtTop = bool(newestMessageAtTopParam);

          if (consoleWindowExists()) {
            getConsoleWindow().setNewestAtTop(newestMessageAtTop);
          }
        };

        this.isScrollToLatestMessage = function () {
          return scrollToLatestMessage;
        };

        this.setScrollToLatestMessage = function (scrollToLatestMessageParam) {
          scrollToLatestMessage = bool(scrollToLatestMessageParam);

          if (consoleWindowExists()) {
            getConsoleWindow().setScrollToLatest(scrollToLatestMessage);
          }
        };

        this.getWidth = function () {
          return width;
        };

        this.setWidth = function (widthParam) {
          if (checkCanConfigure("width")) {
            width = extractStringFromParam(widthParam, width);
          }
        };

        this.getHeight = function () {
          return height;
        };

        this.setHeight = function (heightParam) {
          if (checkCanConfigure("height")) {
            height = extractStringFromParam(heightParam, height);
          }
        };

        this.getMaxMessages = function () {
          return maxMessages;
        };

        this.setMaxMessages = function (maxMessagesParam) {
          maxMessages = extractIntFromParam(maxMessagesParam, maxMessages);

          if (consoleWindowExists()) {
            getConsoleWindow().setMaxMessages(maxMessages);
          }
        };

        this.isShowCommandLine = function () {
          return showCommandLine;
        };

        this.setShowCommandLine = function (showCommandLineParam) {
          showCommandLine = bool(showCommandLineParam);

          if (consoleWindowExists()) {
            getConsoleWindow().setShowCommandLine(showCommandLine);
          }
        };

        this.isShowHideButton = function () {
          return showHideButton;
        };

        this.setShowHideButton = function (showHideButtonParam) {
          showHideButton = bool(showHideButtonParam);

          if (consoleWindowExists()) {
            getConsoleWindow().setShowHideButton(showHideButton);
          }
        };

        this.isShowCloseButton = function () {
          return showCloseButton;
        };

        this.setShowCloseButton = function (showCloseButtonParam) {
          showCloseButton = bool(showCloseButtonParam);

          if (consoleWindowExists()) {
            getConsoleWindow().setShowCloseButton(showCloseButton);
          }
        };

        this.getCommandLineObjectExpansionDepth = function () {
          return commandLineObjectExpansionDepth;
        };

        this.setCommandLineObjectExpansionDepth = function (
          commandLineObjectExpansionDepthParam
        ) {
          commandLineObjectExpansionDepth = extractIntFromParam(
            commandLineObjectExpansionDepthParam,
            commandLineObjectExpansionDepth
          );
        };

        var minimized = initiallyMinimized;

        this.isInitiallyMinimized = function () {
          return initiallyMinimized;
        };

        this.setInitiallyMinimized = function (initiallyMinimizedParam) {
          if (checkCanConfigure("initiallyMinimized")) {
            initiallyMinimized = bool(initiallyMinimizedParam);

            minimized = initiallyMinimized;
          }
        };

        this.isUseDocumentWrite = function () {
          return useDocumentWrite;
        };

        this.setUseDocumentWrite = function (useDocumentWriteParam) {
          if (checkCanConfigure("useDocumentWrite")) {
            useDocumentWrite = bool(useDocumentWriteParam);
          }
        };

        // Common methods

        function QueuedLoggingEvent(loggingEvent, formattedMessage) {
          this.loggingEvent = loggingEvent;

          this.levelName = loggingEvent.level.name;

          this.formattedMessage = formattedMessage;
        }

        QueuedLoggingEvent.prototype.append = function () {
          getConsoleWindow().log(this.levelName, this.formattedMessage);
        };

        function QueuedGroup(name, initiallyExpanded) {
          this.name = name;

          this.initiallyExpanded = initiallyExpanded;
        }

        QueuedGroup.prototype.append = function () {
          getConsoleWindow().group(this.name, this.initiallyExpanded);
        };

        function QueuedGroupEnd() {}

        QueuedGroupEnd.prototype.append = function () {
          getConsoleWindow().groupEnd();
        };

        var checkAndAppend = function () {
          // Next line forces a check of whether the window has been closed

          safeToAppend();

          if (!initialized) {
            init();
          } else if (consoleClosed && reopenWhenClosed) {
            createWindow();
          }

          if (safeToAppend()) {
            appendQueuedLoggingEvents();
          }
        };

        this.append = function (loggingEvent) {
          if (isSupported) {
            // Format the message

            var formattedMessage = appender
              .getLayout()
              .formatWithException(loggingEvent);

            queuedLoggingEvents.push(
              new QueuedLoggingEvent(loggingEvent, formattedMessage)
            );

            checkAndAppend();
          }
        };

        this.group = function (name, initiallyExpanded) {
          if (isSupported) {
            queuedLoggingEvents.push(new QueuedGroup(name, initiallyExpanded));

            checkAndAppend();
          }
        };

        this.groupEnd = function () {
          if (isSupported) {
            queuedLoggingEvents.push(new QueuedGroupEnd());

            checkAndAppend();
          }
        };

        var appendQueuedLoggingEvents = function () {
          while (queuedLoggingEvents.length > 0) {
            queuedLoggingEvents.shift().append();
          }

          if (focusConsoleWindow) {
            getConsoleWindow().focus();
          }
        };

        this.setAddedToLogger = function (logger) {
          this.loggers.push(logger);

          if (enabled && !lazyInit) {
            init();
          }
        };

        this.clear = function () {
          if (consoleWindowExists()) {
            getConsoleWindow().clearLog();
          }

          queuedLoggingEvents.length = 0;
        };

        this.focus = function () {
          if (consoleWindowExists()) {
            getConsoleWindow().focus();
          }
        };

        this.focusCommandLine = function () {
          if (consoleWindowExists()) {
            getConsoleWindow().focusCommandLine();
          }
        };

        this.focusSearch = function () {
          if (consoleWindowExists()) {
            getConsoleWindow().focusSearch();
          }
        };

        var commandWindow = window;

        this.getCommandWindow = function () {
          return commandWindow;
        };

        this.setCommandWindow = function (commandWindowParam) {
          commandWindow = commandWindowParam;
        };

        this.executeLastCommand = function () {
          if (consoleWindowExists()) {
            getConsoleWindow().evalLastCommand();
          }
        };

        var commandLayout = new PatternLayout("%m");

        this.getCommandLayout = function () {
          return commandLayout;
        };

        this.setCommandLayout = function (commandLayoutParam) {
          commandLayout = commandLayoutParam;
        };

        this.evalCommandAndAppend = function (expr) {
          var commandReturnValue = { appendResult: true, isError: false };

          var commandOutput = "";

          // Evaluate the command

          try {
            var result, i;

            // The next three lines constitute a workaround for IE. Bizarrely, iframes seem to have no

            // eval method on the window object initially, but once execScript has been called on

            // it once then the eval method magically appears. See http://www.thismuchiknow.co.uk/?p=25

            if (!commandWindow.eval && commandWindow.execScript) {
              commandWindow.execScript("null");
            }

            var commandLineFunctionsHash = {};

            for (i = 0, len = commandLineFunctions.length; i < len; i++) {
              commandLineFunctionsHash[commandLineFunctions[i][0]] =
                commandLineFunctions[i][1];
            }

            // Keep an array of variables that are being changed in the command window so that they

            // can be restored to their original values afterwards

            var objectsToRestore = [];

            var addObjectToRestore = function (name) {
              objectsToRestore.push([name, commandWindow[name]]);
            };

            addObjectToRestore("appender");

            commandWindow.appender = appender;

            addObjectToRestore("commandReturnValue");

            commandWindow.commandReturnValue = commandReturnValue;

            addObjectToRestore("commandLineFunctionsHash");

            commandWindow.commandLineFunctionsHash = commandLineFunctionsHash;

            var addFunctionToWindow = function (name) {
              addObjectToRestore(name);

              commandWindow[name] = function () {
                return this.commandLineFunctionsHash[name](
                  appender,
                  arguments,
                  commandReturnValue
                );
              };
            };

            for (i = 0, len = commandLineFunctions.length; i < len; i++) {
              addFunctionToWindow(commandLineFunctions[i][0]);
            }

            // Another bizarre workaround to get IE to eval in the global scope

            if (commandWindow === window && commandWindow.execScript) {
              addObjectToRestore("evalExpr");

              addObjectToRestore("result");

              window.evalExpr = expr;

              commandWindow.execScript("window.result=eval(window.evalExpr);");

              result = window.result;
            } else {
              result = commandWindow.eval(expr);
            }

            commandOutput = isUndefined(result)
              ? result
              : formatObjectExpansion(result, commandLineObjectExpansionDepth);

            // Restore variables in the command window to their original state

            for (i = 0, len = objectsToRestore.length; i < len; i++) {
              commandWindow[objectsToRestore[i][0]] = objectsToRestore[i][1];
            }
          } catch (ex) {
            commandOutput =
              "Error evaluating command: " + getExceptionStringRep(ex);

            commandReturnValue.isError = true;
          }

          // Append command output

          if (commandReturnValue.appendResult) {
            var message = ">>> " + expr;

            if (!isUndefined(commandOutput)) {
              message += newLine + commandOutput;
            }

            var level = commandReturnValue.isError ? Level.ERROR : Level.INFO;

            var loggingEvent = new LoggingEvent(
              null,
              new Date(),
              level,
              [message],
              null
            );

            var mainLayout = this.getLayout();

            this.setLayout(commandLayout);

            this.append(loggingEvent);

            this.setLayout(mainLayout);
          }
        };

        var commandLineFunctions = defaultCommandLineFunctions.concat([]);

        this.addCommandLineFunction = function (
          functionName,
          commandLineFunction
        ) {
          commandLineFunctions.push([functionName, commandLineFunction]);
        };

        var commandHistoryCookieName = "log4javascriptCommandHistory";

        this.storeCommandHistory = function (commandHistory) {
          setCookie(commandHistoryCookieName, commandHistory.join(","));
        };

        var writeHtml = function (doc) {
          var lines = getConsoleHtmlLines();

          doc.open();

          for (var i = 0, len = lines.length; i < len; i++) {
            doc.writeln(lines[i]);
          }

          doc.close();
        };

        // Set up event listeners

        this.setEventTypes(["load", "unload"]);

        var consoleWindowLoadHandler = function () {
          var win = getConsoleWindow();

          win.setAppender(appender);

          win.setNewestAtTop(newestMessageAtTop);

          win.setScrollToLatest(scrollToLatestMessage);

          win.setMaxMessages(maxMessages);

          win.setShowCommandLine(showCommandLine);

          win.setShowHideButton(showHideButton);

          win.setShowCloseButton(showCloseButton);

          win.setMainWindow(window);

          // Restore command history stored in cookie

          var storedValue = getCookie(commandHistoryCookieName);

          if (storedValue) {
            win.commandHistory = storedValue.split(",");

            win.currentCommandIndex = win.commandHistory.length;
          }

          appender.dispatchEvent("load", { win: win });
        };

        this.unload = function () {
          logLog.debug("unload " + this + ", caller: " + this.unload.caller);

          if (!consoleClosed) {
            logLog.debug("really doing unload " + this);

            consoleClosed = true;

            consoleWindowLoaded = false;

            consoleWindowCreated = false;

            appender.dispatchEvent("unload", {});
          }
        };

        var pollConsoleWindow = function (
          windowTest,
          interval,
          successCallback,
          errorMessage
        ) {
          function doPoll() {
            try {
              // Test if the console has been closed while polling

              if (consoleClosed) {
                clearInterval(poll);
              }

              if (windowTest(getConsoleWindow())) {
                clearInterval(poll);

                successCallback();
              }
            } catch (ex) {
              clearInterval(poll);

              isSupported = false;

              handleError(errorMessage, ex);
            }
          }

          // Poll the pop-up since the onload event is not reliable

          var poll = setInterval(doPoll, interval);
        };

        var getConsoleUrl = function () {
          var documentDomainSet = document.domain != location.hostname;

          return useDocumentWrite
            ? ""
            : getBaseUrl() +
                "console_uncompressed.html" +
                (documentDomainSet
                  ? "?log4javascript_domain=" + escape(document.domain)
                  : "");
        };

        // Define methods and properties that vary between subclasses

        if (inPage) {
          // InPageAppender

          var containerElement = null;

          // Configuration methods. The function scope is used to prevent

          // direct alteration to the appender configuration properties.

          var cssProperties = [];

          this.addCssProperty = function (name, value) {
            if (checkCanConfigure("cssProperties")) {
              cssProperties.push([name, value]);
            }
          };

          // Define useful variables

          var windowCreationStarted = false;

          var iframeContainerDiv;

          var iframeId = uniqueId + "_InPageAppender_" + consoleAppenderId;

          this.hide = function () {
            if (initialized && consoleWindowCreated) {
              if (consoleWindowExists()) {
                getConsoleWindow().$("command").blur();
              }

              iframeContainerDiv.style.display = "none";

              minimized = true;
            }
          };

          this.show = function () {
            if (initialized) {
              if (consoleWindowCreated) {
                iframeContainerDiv.style.display = "block";

                this.setShowCommandLine(showCommandLine); // Force IE to update

                minimized = false;
              } else if (!windowCreationStarted) {
                createWindow(true);
              }
            }
          };

          this.isVisible = function () {
            return !minimized && !consoleClosed;
          };

          this.close = function (fromButton) {
            if (
              !consoleClosed &&
              (!fromButton ||
                confirm(
                  "This will permanently remove the console from the page. No more messages will be logged. Do you wish to continue?"
                ))
            ) {
              iframeContainerDiv.parentNode.removeChild(iframeContainerDiv);

              this.unload();
            }
          };

          // Create open, init, getConsoleWindow and safeToAppend functions

          open = function () {
            var initErrorMessage =
              "InPageAppender.open: unable to create console iframe";

            function finalInit() {
              try {
                if (!initiallyMinimized) {
                  appender.show();
                }

                consoleWindowLoadHandler();

                consoleWindowLoaded = true;

                appendQueuedLoggingEvents();
              } catch (ex) {
                isSupported = false;

                handleError(initErrorMessage, ex);
              }
            }

            function writeToDocument() {
              try {
                var windowTest = function (win) {
                  return isLoaded(win);
                };

                if (useDocumentWrite) {
                  writeHtml(getConsoleWindow().document);
                }

                if (windowTest(getConsoleWindow())) {
                  finalInit();
                } else {
                  pollConsoleWindow(
                    windowTest,
                    100,
                    finalInit,
                    initErrorMessage
                  );
                }
              } catch (ex) {
                isSupported = false;

                handleError(initErrorMessage, ex);
              }
            }

            minimized = false;

            iframeContainerDiv = containerElement.appendChild(
              document.createElement("div")
            );

            iframeContainerDiv.style.width = width;

            iframeContainerDiv.style.height = height;

            iframeContainerDiv.style.border = "solid gray 1px";

            for (var i = 0, len = cssProperties.length; i < len; i++) {
              iframeContainerDiv.style[cssProperties[i][0]] =
                cssProperties[i][1];
            }

            var iframeSrc = useDocumentWrite
              ? ""
              : " src='" + getConsoleUrl() + "'";

            // Adding an iframe using the DOM would be preferable, but it doesn't work

            // in IE5 on Windows, or in Konqueror prior to version 3.5 - in Konqueror

            // it creates the iframe fine but I haven't been able to find a way to obtain

            // the iframe's window object

            iframeContainerDiv.innerHTML =
              "<iframe id='" +
              iframeId +
              "' name='" +
              iframeId +
              "' width='100%' height='100%' frameborder='0'" +
              iframeSrc +
              " scrolling='no'></iframe>";

            consoleClosed = false;

            // Write the console HTML to the iframe

            var iframeDocumentExistsTest = function (win) {
              try {
                return bool(win) && bool(win.document);
              } catch (ex) {
                return false;
              }
            };

            if (iframeDocumentExistsTest(getConsoleWindow())) {
              writeToDocument();
            } else {
              pollConsoleWindow(
                iframeDocumentExistsTest,
                100,
                writeToDocument,
                initErrorMessage
              );
            }

            consoleWindowCreated = true;
          };

          createWindow = function (show) {
            if (show || !initiallyMinimized) {
              var pageLoadHandler = function () {
                if (!container) {
                  // Set up default container element

                  containerElement = document.createElement("div");

                  containerElement.style.position = "fixed";

                  containerElement.style.left = "0";

                  containerElement.style.right = "0";

                  containerElement.style.bottom = "0";

                  document.body.appendChild(containerElement);

                  appender.addCssProperty("borderWidth", "1px 0 0 0");

                  appender.addCssProperty("zIndex", 1000000); // Can't find anything authoritative that says how big z-index can be

                  open();
                } else {
                  try {
                    var el = document.getElementById(container);

                    if (el.nodeType == 1) {
                      containerElement = el;
                    }

                    open();
                  } catch (ex) {
                    handleError(
                      "InPageAppender.init: invalid container element '" +
                        container +
                        "' supplied",
                      ex
                    );
                  }
                }
              };

              // Test the type of the container supplied. First, check if it's an element

              if (pageLoaded && container && container.appendChild) {
                containerElement = container;

                open();
              } else if (pageLoaded) {
                pageLoadHandler();
              } else {
                log4javascript.addEventListener("load", pageLoadHandler);
              }

              windowCreationStarted = true;
            }
          };

          init = function () {
            createWindow();

            initialized = true;
          };

          getConsoleWindow = function () {
            var iframe = window.frames[iframeId];

            if (iframe) {
              return iframe;
            }
          };

          safeToAppend = function () {
            if (isSupported && !consoleClosed) {
              if (
                consoleWindowCreated &&
                !consoleWindowLoaded &&
                getConsoleWindow() &&
                isLoaded(getConsoleWindow())
              ) {
                consoleWindowLoaded = true;
              }

              return consoleWindowLoaded;
            }

            return false;
          };
        } else {
          // PopUpAppender

          // Extract params

          var useOldPopUp = appender.defaults.useOldPopUp;

          var complainAboutPopUpBlocking =
            appender.defaults.complainAboutPopUpBlocking;

          var reopenWhenClosed = this.defaults.reopenWhenClosed;

          // Configuration methods. The function scope is used to prevent

          // direct alteration to the appender configuration properties.

          this.isUseOldPopUp = function () {
            return useOldPopUp;
          };

          this.setUseOldPopUp = function (useOldPopUpParam) {
            if (checkCanConfigure("useOldPopUp")) {
              useOldPopUp = bool(useOldPopUpParam);
            }
          };

          this.isComplainAboutPopUpBlocking = function () {
            return complainAboutPopUpBlocking;
          };

          this.setComplainAboutPopUpBlocking = function (
            complainAboutPopUpBlockingParam
          ) {
            if (checkCanConfigure("complainAboutPopUpBlocking")) {
              complainAboutPopUpBlocking = bool(
                complainAboutPopUpBlockingParam
              );
            }
          };

          this.isFocusPopUp = function () {
            return focusConsoleWindow;
          };

          this.setFocusPopUp = function (focusPopUpParam) {
            // This property can be safely altered after logging has started

            focusConsoleWindow = bool(focusPopUpParam);
          };

          this.isReopenWhenClosed = function () {
            return reopenWhenClosed;
          };

          this.setReopenWhenClosed = function (reopenWhenClosedParam) {
            // This property can be safely altered after logging has started

            reopenWhenClosed = bool(reopenWhenClosedParam);
          };

          this.close = function () {
            logLog.debug("close " + this);

            try {
              popUp.close();

              this.unload();
            } catch (ex) {
              // Do nothing
            }
          };

          this.hide = function () {
            logLog.debug("hide " + this);

            if (consoleWindowExists()) {
              this.close();
            }
          };

          this.show = function () {
            logLog.debug("show " + this);

            if (!consoleWindowCreated) {
              open();
            }
          };

          this.isVisible = function () {
            return safeToAppend();
          };

          // Define useful variables

          var popUp;

          // Create open, init, getConsoleWindow and safeToAppend functions

          open = function () {
            var windowProperties =
              "width=" + width + ",height=" + height + ",status,resizable";

            var frameInfo = "";

            try {
              var frameEl = window.frameElement;

              if (frameEl) {
                frameInfo =
                  "_" +
                  frameEl.tagName +
                  "_" +
                  (frameEl.name || frameEl.id || "");
              }
            } catch (e) {
              frameInfo = "_inaccessibleParentFrame";
            }

            var windowName =
              "PopUp_" +
              location.host.replace(/[^a-z0-9]/gi, "_") +
              "_" +
              consoleAppenderId +
              frameInfo;

            if (!useOldPopUp || !useDocumentWrite) {
              // Ensure a previous window isn't used by using a unique name

              windowName = windowName + "_" + uniqueId;
            }

            var checkPopUpClosed = function (win) {
              if (consoleClosed) {
                return true;
              } else {
                try {
                  return bool(win) && win.closed;
                } catch (ex) {}
              }

              return false;
            };

            var popUpClosedCallback = function () {
              if (!consoleClosed) {
                appender.unload();
              }
            };

            function finalInit() {
              getConsoleWindow().setCloseIfOpenerCloses(
                !useOldPopUp || !useDocumentWrite
              );

              consoleWindowLoadHandler();

              consoleWindowLoaded = true;

              appendQueuedLoggingEvents();

              pollConsoleWindow(
                checkPopUpClosed,
                500,
                popUpClosedCallback,

                "PopUpAppender.checkPopUpClosed: error checking pop-up window"
              );
            }

            try {
              popUp = window.open(
                getConsoleUrl(),
                windowName,
                windowProperties
              );

              consoleClosed = false;

              consoleWindowCreated = true;

              if (popUp && popUp.document) {
                if (useDocumentWrite && useOldPopUp && isLoaded(popUp)) {
                  popUp.mainPageReloaded();

                  finalInit();
                } else {
                  if (useDocumentWrite) {
                    writeHtml(popUp.document);
                  }

                  // Check if the pop-up window object is available

                  var popUpLoadedTest = function (win) {
                    return bool(win) && isLoaded(win);
                  };

                  if (isLoaded(popUp)) {
                    finalInit();
                  } else {
                    pollConsoleWindow(
                      popUpLoadedTest,
                      100,
                      finalInit,

                      "PopUpAppender.init: unable to create console window"
                    );
                  }
                }
              } else {
                isSupported = false;

                logLog.warn(
                  "PopUpAppender.init: pop-ups blocked, please unblock to use PopUpAppender"
                );

                if (complainAboutPopUpBlocking) {
                  handleError(
                    "log4javascript: pop-up windows appear to be blocked. Please unblock them to use pop-up logging."
                  );
                }
              }
            } catch (ex) {
              handleError("PopUpAppender.init: error creating pop-up", ex);
            }
          };

          createWindow = function () {
            if (!initiallyMinimized) {
              open();
            }
          };

          init = function () {
            createWindow();

            initialized = true;
          };

          getConsoleWindow = function () {
            return popUp;
          };

          safeToAppend = function () {
            if (isSupported && !isUndefined(popUp) && !consoleClosed) {
              if (
                popUp.closed ||
                (consoleWindowLoaded && isUndefined(popUp.closed))
              ) {
                // Extra check for Opera

                appender.unload();

                logLog.debug("PopUpAppender: pop-up closed");

                return false;
              }

              if (!consoleWindowLoaded && isLoaded(popUp)) {
                consoleWindowLoaded = true;
              }
            }

            return isSupported && consoleWindowLoaded && !consoleClosed;
          };
        }

        // Expose getConsoleWindow so that automated tests can check the DOM

        this.getConsoleWindow = getConsoleWindow;
      };

      ConsoleAppender.addGlobalCommandLineFunction = function (
        functionName,
        commandLineFunction
      ) {
        defaultCommandLineFunctions.push([functionName, commandLineFunction]);
      };

      /* ------------------------------------------------------------------ */

      function PopUpAppender(
        lazyInit,
        initiallyMinimized,
        useDocumentWrite,

        width,
        height
      ) {
        this.create(
          false,
          null,
          lazyInit,
          initiallyMinimized,

          useDocumentWrite,
          width,
          height,
          this.defaults.focusPopUp
        );
      }

      PopUpAppender.prototype = new ConsoleAppender();

      PopUpAppender.prototype.defaults = {
        layout: new PatternLayout("%d{HH:mm:ss} %-5p - %m{1}%n"),

        initiallyMinimized: false,

        focusPopUp: false,

        lazyInit: true,

        useOldPopUp: true,

        complainAboutPopUpBlocking: true,

        newestMessageAtTop: false,

        scrollToLatestMessage: true,

        width: "600",

        height: "400",

        reopenWhenClosed: false,

        maxMessages: null,

        showCommandLine: true,

        commandLineObjectExpansionDepth: 1,

        showHideButton: false,

        showCloseButton: true,

        useDocumentWrite: true,
      };

      PopUpAppender.prototype.toString = function () {
        return "PopUpAppender";
      };

      log4javascript.PopUpAppender = PopUpAppender;

      /* ------------------------------------------------------------------ */

      function InPageAppender(
        container,
        lazyInit,
        initiallyMinimized,

        useDocumentWrite,
        width,
        height
      ) {
        this.create(
          true,
          container,
          lazyInit,
          initiallyMinimized,

          useDocumentWrite,
          width,
          height,
          false
        );
      }

      InPageAppender.prototype = new ConsoleAppender();

      InPageAppender.prototype.defaults = {
        layout: new PatternLayout("%d{HH:mm:ss} %-5p - %m{1}%n"),

        initiallyMinimized: false,

        lazyInit: true,

        newestMessageAtTop: false,

        scrollToLatestMessage: true,

        width: "100%",

        height: "220px",

        maxMessages: null,

        showCommandLine: true,

        commandLineObjectExpansionDepth: 1,

        showHideButton: false,

        showCloseButton: false,

        showLogEntryDeleteButtons: true,

        useDocumentWrite: true,
      };

      InPageAppender.prototype.toString = function () {
        return "InPageAppender";
      };

      log4javascript.InPageAppender = InPageAppender;

      // Next line for backwards compatibility

      log4javascript.InlineAppender = InPageAppender;
    })();

    /* ---------------------------------------------------------------------- */

    // Console extension functions

    function padWithSpaces(str, len) {
      if (str.length < len) {
        var spaces = [];

        var numberOfSpaces = Math.max(0, len - str.length);

        for (var i = 0; i < numberOfSpaces; i++) {
          spaces[i] = " ";
        }

        str += spaces.join("");
      }

      return str;
    }

    (function () {
      function dir(obj) {
        var maxLen = 0;

        // Obtain the length of the longest property name

        for (var p in obj) {
          maxLen = Math.max(toStr(p).length, maxLen);
        }

        // Create the nicely formatted property list

        var propList = [];

        for (p in obj) {
          var propNameStr = "  " + padWithSpaces(toStr(p), maxLen + 2);

          var propVal;

          try {
            propVal = splitIntoLines(toStr(obj[p])).join(
              padWithSpaces(newLine, maxLen + 6)
            );
          } catch (ex) {
            propVal =
              "[Error obtaining property. Details: " +
              getExceptionMessage(ex) +
              "]";
          }

          propList.push(propNameStr + propVal);
        }

        return propList.join(newLine);
      }

      var nodeTypes = {
        ELEMENT_NODE: 1,

        ATTRIBUTE_NODE: 2,

        TEXT_NODE: 3,

        CDATA_SECTION_NODE: 4,

        ENTITY_REFERENCE_NODE: 5,

        ENTITY_NODE: 6,

        PROCESSING_INSTRUCTION_NODE: 7,

        COMMENT_NODE: 8,

        DOCUMENT_NODE: 9,

        DOCUMENT_TYPE_NODE: 10,

        DOCUMENT_FRAGMENT_NODE: 11,

        NOTATION_NODE: 12,
      };

      var preFormattedElements = ["script", "pre"];

      // This should be the definitive list, as specified by the XHTML 1.0 Transitional DTD

      var emptyElements = [
        "br",
        "img",
        "hr",
        "param",
        "link",
        "area",
        "input",
        "col",
        "base",
        "meta",
      ];

      var indentationUnit = "  ";

      // Create and return an XHTML string from the node specified

      function getXhtml(
        rootNode,
        includeRootNode,
        indentation,
        startNewLine,
        preformatted
      ) {
        includeRootNode =
          typeof includeRootNode == "undefined" ? true : !!includeRootNode;

        if (typeof indentation != "string") {
          indentation = "";
        }

        startNewLine = !!startNewLine;

        preformatted = !!preformatted;

        var xhtml;

        function isWhitespace(node) {
          return (
            node.nodeType == nodeTypes.TEXT_NODE &&
            /^[ \t\r\n]*$/.test(node.nodeValue)
          );
        }

        function fixAttributeValue(attrValue) {
          return attrValue
            .toString()
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/"/g, "&quot;");
        }

        function getStyleAttributeValue(el) {
          var stylePairs = el.style.cssText.split(";");

          var styleValue = "";

          for (var j = 0, len = stylePairs.length; j < len; j++) {
            var nameValueBits = stylePairs[j].split(":");

            var props = [];

            if (!/^\s*$/.test(nameValueBits[0])) {
              props.push(
                trim(nameValueBits[0]).toLowerCase() +
                  ":" +
                  trim(nameValueBits[1])
              );
            }

            styleValue = props.join(";");
          }

          return styleValue;
        }

        function getNamespace(el) {
          if (el.prefix) {
            return el.prefix;
          } else if (el.outerHTML) {
            var regex = new RegExp("<([^:]+):" + el.tagName + "[^>]*>", "i");

            if (regex.test(el.outerHTML)) {
              return RegExp.$1.toLowerCase();
            }
          }

          return "";
        }

        var lt = "<";

        var gt = ">";

        var i, len;

        if (
          includeRootNode &&
          rootNode.nodeType != nodeTypes.DOCUMENT_FRAGMENT_NODE
        ) {
          switch (rootNode.nodeType) {
            case nodeTypes.ELEMENT_NODE:
              var tagName = rootNode.tagName.toLowerCase();

              xhtml = startNewLine ? newLine + indentation : "";

              xhtml += lt;

              // Allow for namespaces, where present

              var prefix = getNamespace(rootNode);

              var hasPrefix = !!prefix;

              if (hasPrefix) {
                xhtml += prefix + ":";
              }

              xhtml += tagName;

              for (i = 0, len = rootNode.attributes.length; i < len; i++) {
                var currentAttr = rootNode.attributes[i];

                // Check the attribute is valid.

                if (
                  !currentAttr.specified ||
                  currentAttr.nodeValue === null ||
                  currentAttr.nodeName.toLowerCase() === "style" ||
                  typeof currentAttr.nodeValue !== "string" ||
                  currentAttr.nodeName.indexOf("_moz") === 0
                ) {
                  continue;
                }

                xhtml += " " + currentAttr.nodeName.toLowerCase() + '="';

                xhtml += fixAttributeValue(currentAttr.nodeValue);

                xhtml += '"';
              }

              // Style needs to be done separately as it is not reported as an

              // attribute in IE

              if (rootNode.style.cssText) {
                var styleValue = getStyleAttributeValue(rootNode);

                if (styleValue !== "") {
                  xhtml += ' style="' + getStyleAttributeValue(rootNode) + '"';
                }
              }

              if (
                array_contains(emptyElements, tagName) ||
                (hasPrefix && !rootNode.hasChildNodes())
              ) {
                xhtml += "/" + gt;
              } else {
                xhtml += gt;

                // Add output for childNodes collection (which doesn't include attribute nodes)

                var childStartNewLine = !(
                  rootNode.childNodes.length === 1 &&
                  rootNode.childNodes[0].nodeType === nodeTypes.TEXT_NODE
                );

                var childPreformatted = array_contains(
                  preFormattedElements,
                  tagName
                );

                for (i = 0, len = rootNode.childNodes.length; i < len; i++) {
                  xhtml += getXhtml(
                    rootNode.childNodes[i],
                    true,
                    indentation + indentationUnit,

                    childStartNewLine,
                    childPreformatted
                  );
                }

                // Add the end tag

                var endTag = lt + "/" + tagName + gt;

                xhtml += childStartNewLine
                  ? newLine + indentation + endTag
                  : endTag;
              }

              return xhtml;

            case nodeTypes.TEXT_NODE:
              if (isWhitespace(rootNode)) {
                xhtml = "";
              } else {
                if (preformatted) {
                  xhtml = rootNode.nodeValue;
                } else {
                  // Trim whitespace from each line of the text node

                  var lines = splitIntoLines(trim(rootNode.nodeValue));

                  var trimmedLines = [];

                  for (i = 0, len = lines.length; i < len; i++) {
                    trimmedLines[i] = trim(lines[i]);
                  }

                  xhtml = trimmedLines.join(newLine + indentation);
                }

                if (startNewLine) {
                  xhtml = newLine + indentation + xhtml;
                }
              }

              return xhtml;

            case nodeTypes.CDATA_SECTION_NODE:
              return (
                "<![CDA" + "TA[" + rootNode.nodeValue + "]" + "]>" + newLine
              );

            case nodeTypes.DOCUMENT_NODE:
              xhtml = "";

              // Add output for childNodes collection (which doesn't include attribute nodes)

              for (i = 0, len = rootNode.childNodes.length; i < len; i++) {
                xhtml += getXhtml(rootNode.childNodes[i], true, indentation);
              }

              return xhtml;

            default:
              return "";
          }
        } else {
          xhtml = "";

          // Add output for childNodes collection (which doesn't include attribute nodes)

          for (i = 0, len = rootNode.childNodes.length; i < len; i++) {
            xhtml += getXhtml(
              rootNode.childNodes[i],
              true,
              indentation + indentationUnit
            );
          }

          return xhtml;
        }
      }

      function createCommandLineFunctions() {
        ConsoleAppender.addGlobalCommandLineFunction(
          "$",
          function (appender, args, returnValue) {
            return document.getElementById(args[0]);
          }
        );

        ConsoleAppender.addGlobalCommandLineFunction(
          "dir",
          function (appender, args, returnValue) {
            var lines = [];

            for (var i = 0, len = args.length; i < len; i++) {
              lines[i] = dir(args[i]);
            }

            return lines.join(newLine + newLine);
          }
        );

        ConsoleAppender.addGlobalCommandLineFunction(
          "dirxml",
          function (appender, args, returnValue) {
            var lines = [];

            for (var i = 0, len = args.length; i < len; i++) {
              lines[i] = getXhtml(args[i]);
            }

            return lines.join(newLine + newLine);
          }
        );

        ConsoleAppender.addGlobalCommandLineFunction(
          "cd",
          function (appender, args, returnValue) {
            var win, message;

            if (args.length === 0 || args[0] === "") {
              win = window;

              message = "Command line set to run in main window";
            } else {
              if (args[0].window == args[0]) {
                win = args[0];

                message =
                  "Command line set to run in frame '" + args[0].name + "'";
              } else {
                win = window.frames[args[0]];

                if (win) {
                  message =
                    "Command line set to run in frame '" + args[0] + "'";
                } else {
                  returnValue.isError = true;

                  message = "Frame '" + args[0] + "' does not exist";

                  win = appender.getCommandWindow();
                }
              }
            }

            appender.setCommandWindow(win);

            return message;
          }
        );

        ConsoleAppender.addGlobalCommandLineFunction(
          "clear",
          function (appender, args, returnValue) {
            returnValue.appendResult = false;

            appender.clear();
          }
        );

        ConsoleAppender.addGlobalCommandLineFunction(
          "keys",
          function (appender, args, returnValue) {
            var keys = [];

            for (var k in args[0]) {
              keys.push(k);
            }

            return keys;
          }
        );

        ConsoleAppender.addGlobalCommandLineFunction(
          "values",
          function (appender, args, returnValue) {
            var values = [];

            for (var k in args[0]) {
              try {
                values.push(args[0][k]);
              } catch (ex) {
                logLog.warn(
                  "values(): Unable to obtain value for key " +
                    k +
                    ". Details: " +
                    getExceptionMessage(ex)
                );
              }
            }

            return values;
          }
        );

        ConsoleAppender.addGlobalCommandLineFunction(
          "expansionDepth",
          function (appender, args, returnValue) {
            var expansionDepth = parseInt(args[0], 10);

            if (isNaN(expansionDepth) || expansionDepth < 0) {
              returnValue.isError = true;

              return "" + args[0] + " is not a valid expansion depth";
            } else {
              appender.setCommandLineObjectExpansionDepth(expansionDepth);

              return "Object expansion depth set to " + expansionDepth;
            }
          }
        );
      }

      function init() {
        // Add command line functions

        createCommandLineFunctions();
      }

      /* ------------------------------------------------------------------ */

      init();
    })();

    /* ---------------------------------------------------------------------- */

    function createDefaultLogger() {
      var logger = log4javascript.getLogger(defaultLoggerName);

      var a = new log4javascript.PopUpAppender();

      logger.addAppender(a);

      return logger;
    }

    /* ---------------------------------------------------------------------- */

    // Main load

    log4javascript.setDocumentReady = function () {
      pageLoaded = true;

      log4javascript.dispatchEvent("load", {});
    };

    if (window.addEventListener) {
      window.addEventListener("load", log4javascript.setDocumentReady, false);
    } else if (window.attachEvent) {
      window.attachEvent("onload", log4javascript.setDocumentReady);
    } else {
      var oldOnload = window.onload;

      if (typeof window.onload != "function") {
        window.onload = log4javascript.setDocumentReady;
      } else {
        window.onload = function (evt) {
          if (oldOnload) {
            oldOnload(evt);
          }

          log4javascript.setDocumentReady();
        };
      }
    }

    return log4javascript;
  }, this);
  /*!
   * accounting.js v0.4.2
   * Copyright 2014 Open Exchange Rates
   *
   * Freely distributable under the MIT license.
   * Portions of accounting.js are inspired or borrowed from underscore.js
   *
   * Full details and documentation:
   * http://openexchangerates.github.io/accounting.js/
   */

  (function (root, undefined) {
    /* --- Setup --- */

    // Create the local library object, to be exported or referenced globally later
    var lib = {};

    // Current version
    lib.version = "0.4.2";

    /* --- Exposed settings --- */

    // The library's settings configuration object. Contains default parameters for
    // currency and number formatting
    lib.settings = {
      currency: {
        symbol: "$", // default currency symbol is '$'
        format: "%s%v", // controls output: %s = symbol, %v = value (can be object, see docs)
        decimal: ".", // decimal point separator
        thousand: ",", // thousands separator
        precision: 2, // decimal places
        grouping: 3, // digit grouping (not implemented yet)
      },
      number: {
        precision: 0, // default precision on numbers is 0
        grouping: 3, // digit grouping (not implemented yet)
        thousand: ",",
        decimal: ".",
      },
    };

    /* --- Internal Helper Methods --- */

    // Store reference to possibly-available ECMAScript 5 methods for later
    var nativeMap = Array.prototype.map,
      nativeIsArray = Array.isArray,
      toString = Object.prototype.toString;

    /**
     * Tests whether supplied parameter is a string
     * from underscore.js
     */
    function isString(obj) {
      return !!(obj === "" || (obj && obj.charCodeAt && obj.substr));
    }

    /**
     * Tests whether supplied parameter is an array
     * from underscore.js, delegates to ECMA5's native Array.isArray
     */
    function isArray(obj) {
      return nativeIsArray
        ? nativeIsArray(obj)
        : toString.call(obj) === "[object Array]";
    }

    /**
     * Tests whether supplied parameter is a true object
     */
    function isObject(obj) {
      return obj && toString.call(obj) === "[object Object]";
    }

    /**
     * Extends an object with a defaults object, similar to underscore's _.defaults
     *
     * Used for abstracting parameter handling from API methods
     */
    function defaults(object, defs) {
      var key;
      object = object || {};
      defs = defs || {};
      // Iterate over object non-prototype properties:
      for (key in defs) {
        if (defs.hasOwnProperty(key)) {
          // Replace values with defaults only if undefined (allow empty/zero values):
          if (object[key] == null) object[key] = defs[key];
        }
      }
      return object;
    }

    /**
     * Implementation of `Array.map()` for iteration loops
     *
     * Returns a new Array as a result of calling `iterator` on each array value.
     * Defers to native Array.map if available
     */
    function map(obj, iterator, context) {
      var results = [],
        i,
        j;

      if (!obj) return results;

      // Use native .map method if it exists:
      if (nativeMap && obj.map === nativeMap) return obj.map(iterator, context);

      // Fallback for native .map:
      for (i = 0, j = obj.length; i < j; i++) {
        results[i] = iterator.call(context, obj[i], i, obj);
      }
      return results;
    }

    /**
     * Check and normalise the value of precision (must be positive integer)
     */
    function checkPrecision(val, base) {
      val = Math.round(Math.abs(val));
      return isNaN(val) ? base : val;
    }

    /**
     * Parses a format string or object and returns format obj for use in rendering
     *
     * `format` is either a string with the default (positive) format, or object
     * containing `pos` (required), `neg` and `zero` values (or a function returning
     * either a string or object)
     *
     * Either string or format.pos must contain "%v" (value) to be valid
     */
    function checkCurrencyFormat(format) {
      var defaults = lib.settings.currency.format;

      // Allow function as format parameter (should return string or object):
      if (typeof format === "function") format = format();

      // Format can be a string, in which case `value` ("%v") must be present:
      if (isString(format) && format.match("%v")) {
        // Create and return positive, negative and zero formats:
        return {
          pos: format,
          neg: format.replace("-", "").replace("%v", "-%v"),
          zero: format,
        };

        // If no format, or object is missing valid positive value, use defaults:
      } else if (!format || !format.pos || !format.pos.match("%v")) {
        // If defaults is a string, casts it to an object for faster checking next time:
        return !isString(defaults)
          ? defaults
          : (lib.settings.currency.format = {
              pos: defaults,
              neg: defaults.replace("%v", "-%v"),
              zero: defaults,
            });
      }
      // Otherwise, assume format was fine:
      return format;
    }

    /* --- API Methods --- */

    /**
     * Takes a string/array of strings, removes all formatting/cruft and returns the raw float value
     * Alias: `accounting.parse(string)`
     *
     * Decimal must be included in the regular expression to match floats (defaults to
     * accounting.settings.number.decimal), so if the number uses a non-standard decimal
     * separator, provide it as the second argument.
     *
     * Also matches bracketed negatives (eg. "$ (1.99)" => -1.99)
     *
     * Doesn't throw any errors (`NaN`s become 0) but this may change in future
     */
    var unformat =
      (lib.unformat =
      lib.parse =
        function (value, decimal) {
          // Recursively unformat arrays:
          if (isArray(value)) {
            return map(value, function (val) {
              return unformat(val, decimal);
            });
          }

          // Fails silently (need decent errors):
          value = value || 0;

          // Return the value as-is if it's already a number:
          if (typeof value === "number") return value;

          // Default decimal point comes from settings, but could be set to eg. "," in opts:
          decimal = decimal || lib.settings.number.decimal;

          // Build regex to strip out everything except digits, decimal point and minus sign:
          var regex = new RegExp("[^0-9-" + decimal + "]", ["g"]),
            unformatted = parseFloat(
              ("" + value)
                .replace(/\((?=\d+)(.*)\)/, "-$1") // replace bracketed values with negatives
                .replace(regex, "") // strip out any cruft
                .replace(decimal, ".") // make sure decimal point is standard
            );

          // This will fail silently which may cause trouble, let's wait and see:
          return !isNaN(unformatted) ? unformatted : 0;
        });

    /**
     * Implementation of toFixed() that treats floats more like decimals
     *
     * Fixes binary rounding issues (eg. (0.615).toFixed(2) === "0.61") that present
     * problems for accounting- and finance-related software.
     */
    var toFixed = (lib.toFixed = function (value, precision) {
      precision = checkPrecision(precision, lib.settings.number.precision);

      var exponentialForm = Number(lib.unformat(value) + "e" + precision);
      var rounded = Math.round(exponentialForm);
      var finalResult = Number(rounded + "e-" + precision).toFixed(precision);
      return finalResult;
    });

    /**
     * Format a number, with comma-separated thousands and custom precision/decimal places
     * Alias: `accounting.format()`
     *
     * Localise by overriding the precision and thousand / decimal separators
     * 2nd parameter `precision` can be an object matching `settings.number`
     */
    var formatNumber =
      (lib.formatNumber =
      lib.format =
        function (number, precision, thousand, decimal) {
          // Resursively format arrays:
          if (isArray(number)) {
            return map(number, function (val) {
              return formatNumber(val, precision, thousand, decimal);
            });
          }

          // Clean up number:
          number = unformat(number);

          // Build options object from second param (if object) or all params, extending defaults:
          var opts = defaults(
              isObject(precision)
                ? precision
                : {
                    precision: precision,
                    thousand: thousand,
                    decimal: decimal,
                  },
              lib.settings.number
            ),
            // Clean up precision
            usePrecision = checkPrecision(opts.precision),
            // Do some calc:
            negative = number < 0 ? "-" : "",
            base =
              parseInt(toFixed(Math.abs(number || 0), usePrecision), 10) + "",
            mod = base.length > 3 ? base.length % 3 : 0;

          // Format the number:
          return (
            negative +
            (mod ? base.substr(0, mod) + opts.thousand : "") +
            base.substr(mod).replace(/(\d{3})(?=\d)/g, "$1" + opts.thousand) +
            (usePrecision
              ? opts.decimal +
                toFixed(Math.abs(number), usePrecision).split(".")[1]
              : "")
          );
        });

    /**
     * Format a number into currency
     *
     * Usage: accounting.formatMoney(number, symbol, precision, thousandsSep, decimalSep, format)
     * defaults: (0, "$", 2, ",", ".", "%s%v")
     *
     * Localise by overriding the symbol, precision, thousand / decimal separators and format
     * Second param can be an object matching `settings.currency` which is the easiest way.
     *
     * To do: tidy up the parameters
     */
    var formatMoney = (lib.formatMoney = function (
      number,
      symbol,
      precision,
      thousand,
      decimal,
      format
    ) {
      // Resursively format arrays:
      if (isArray(number)) {
        return map(number, function (val) {
          return formatMoney(val, symbol, precision, thousand, decimal, format);
        });
      }

      // Clean up number:
      number = unformat(number);

      // Build options object from second param (if object) or all params, extending defaults:
      var opts = defaults(
          isObject(symbol)
            ? symbol
            : {
                symbol: symbol,
                precision: precision,
                thousand: thousand,
                decimal: decimal,
                format: format,
              },
          lib.settings.currency
        ),
        // Check format (returns object with pos, neg and zero):
        formats = checkCurrencyFormat(opts.format),
        // Choose which format to use for this value:
        useFormat =
          number > 0 ? formats.pos : number < 0 ? formats.neg : formats.zero;

      // Return with currency symbol added:
      return useFormat
        .replace("%s", opts.symbol)
        .replace(
          "%v",
          formatNumber(
            Math.abs(number),
            checkPrecision(opts.precision),
            opts.thousand,
            opts.decimal
          )
        );
    });

    /**
     * Format a list of numbers into an accounting column, padding with whitespace
     * to line up currency symbols, thousand separators and decimals places
     *
     * List should be an array of numbers
     * Second parameter can be an object containing keys that match the params
     *
     * Returns array of accouting-formatted number strings of same length
     *
     * NB: `white-space:pre` CSS rule is required on the list container to prevent
     * browsers from collapsing the whitespace in the output strings.
     */
    lib.formatColumn = function (
      list,
      symbol,
      precision,
      thousand,
      decimal,
      format
    ) {
      if (!list || !isArray(list)) return [];

      // Build options object from second param (if object) or all params, extending defaults:
      var opts = defaults(
          isObject(symbol)
            ? symbol
            : {
                symbol: symbol,
                precision: precision,
                thousand: thousand,
                decimal: decimal,
                format: format,
              },
          lib.settings.currency
        ),
        // Check format (returns object with pos, neg and zero), only need pos for now:
        formats = checkCurrencyFormat(opts.format),
        // Whether to pad at start of string or after currency symbol:
        padAfterSymbol =
          formats.pos.indexOf("%s") < formats.pos.indexOf("%v") ? true : false,
        // Store value for the length of the longest string in the column:
        maxLength = 0,
        // Format the list according to options, store the length of the longest string:
        formatted = map(list, function (val, i) {
          if (isArray(val)) {
            // Recursively format columns if list is a multi-dimensional array:
            return lib.formatColumn(val, opts);
          } else {
            // Clean up the value
            val = unformat(val);

            // Choose which format to use for this value (pos, neg or zero):
            var useFormat =
                val > 0 ? formats.pos : val < 0 ? formats.neg : formats.zero,
              // Format this value, push into formatted list and save the length:
              fVal = useFormat
                .replace("%s", opts.symbol)
                .replace(
                  "%v",
                  formatNumber(
                    Math.abs(val),
                    checkPrecision(opts.precision),
                    opts.thousand,
                    opts.decimal
                  )
                );

            if (fVal.length > maxLength) maxLength = fVal.length;
            return fVal;
          }
        });

      // Pad each number in the list and send back the column of numbers:
      return map(formatted, function (val, i) {
        // Only if this is a string (not a nested array, which would have already been padded):
        if (isString(val) && val.length < maxLength) {
          // Depending on symbol position, pad after symbol or at index 0:
          return padAfterSymbol
            ? val.replace(
                opts.symbol,
                opts.symbol + new Array(maxLength - val.length + 1).join(" ")
              )
            : new Array(maxLength - val.length + 1).join(" ") + val;
        }
        return val;
      });
    };

    /* --- Module Definition --- */

    // Export accounting for CommonJS. If being loaded as an AMD module, define it as such.
    // Otherwise, just add `accounting` to the global object

    // Declare `fx` on the root (global/window) object:
    root["accounting"] = lib;

    // Root will be `window` in browser or `global` on the server:
  })(this);
}).call(
  (this.shortcuts.widgets.vendor = this.shortcuts.widgets.vendor || {}),
  this.shortcuts.widgets
);
(function (root) {
  /* jQuery extensions */
  (function (jqFn) {
    jqFn.shortcutsWidget = function (path, options) {
      return root.shortcuts.widgets.handlers.loadNewWidget(
        path,
        this.first(),
        options
      );
    };
  })($.fn);
  $.datepick.setDefaults({
    useMouseWheel: true,
    pickerClass: "sw-datepicker",
    showAnim: "fadeIn",
    showOptions: null,
    onShow: function (picker) {
      var pickerPopup, pickerPopupEvents;
      pickerPopup = picker.parent();
      pickerPopupEvents = $._data(pickerPopup[0], "events");
      if (
        typeof pickerPopupEvents === "undefined" ||
        (typeof pickerPopupEvents !== "undefined" && !pickerPopupEvents.click)
      )
        pickerPopup.on("click", function (event) {
          event.stopPropagation();
        });
    },
    renderer: $.extend({}, $.datepick.defaultRenderer, {
      picker: $.datepick.defaultRenderer.picker
        .replace(/\{link:prev\}/, "{link:prevJump}{link:prev}")
        .replace(/\{link:next\}/, "{link:nextJump}{link:next}"),
    }),
  });
})(this);
(function (root) {
  var sw;
  sw = root.shortcuts.widgets;
  sw.strings = {
    dayOfWeek: {
      sunday: "Sunday",
      shortSunday: "Sun",
      monday: "Monday",
      shortMonday: "Mon",
      tuesday: "Tuesday",
      shortTuesday: "Tue",
      wednesday: "Wednesday",
      shortWednesday: "Wed",
      thursday: "Thursday",
      shortThursday: "Thu",
      friday: "Friday",
      shortFriday: "Fri",
      saturday: "Saturday",
      shortSaturday: "Sat",
    },
    monthsOfYear: [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ],
    alert: "Alert",
    ok: "Ok",
    yes: "Yes",
    no: "No",
    systemError:
      "Sorry, there was a problem with our servers. Please try again later.",
    unauthorisedError:
      "There is a problem with your account. Please refresh the page, or try again later.",
    sessionTimeout:
      "Sorry, there was a problem trying to contact our servers. Please refresh the page, or try again later.",
    invalidVersion:
      "This webpage has recently been updated. Please refresh the page.",
    cannotUseFaceBookLoginError:
      "You already have an account with us that was not created with Facebook. Please log in by entering your email address.",
    cannotUseFaceBookLoginErrorTitle: "Cannot Use Facebook Login",
    invalidLoginCredentials: "This Facebook account cannot be used to log in.",
    siteOfflineError:
      "This business is temporarily offline. Please try again later, or call us within business hours.",
    siteOfflineErrorTitle: "Site Currently Offline",

    cardNamePlaceholder: "Name on Card",
    numberPlaceholder: "Card Number",
    expiryPlaceholder: "MM/YY",
    cvvPlaceholder: "CVV",
    submitText: "Save Changes",
    invalidCardError: "Invalid card details",
    unknownCardError: "Error validating card",
  };
})(this);

(function (root) {
  var sw, events;
  sw = root.shortcuts.widgets;
  events = sw.events = {};

  // Common event names
  // Widget has fulfilled its purpose, but there are no widgets to hand back to
  events.WIDGET_DONE = "shortcutsWidgetDone";

  // Widget is loading
  events.WIDGET_LOADING = "shortcutsWidgetLoading";

  // Widget is fully loaded and rendered
  events.WIDGET_RENDERED = "shortcutsWidgetRendered";
  // Widget has begun an AJAX request
  events.WIDGET_AJAX_BEGIN = "shortcutsWidgetAjaxBegin";
  // Widget has finished an AJAX request
  events.WIDGET_AJAX_END = "shortcutsWidgetAjaxEnd";

  // Widget-specific event names
  events.ON_SERVICE_SELECTED_BOOKING = "shortcutsWidgetOnServiceSelected";
  events.ON_SERVICE_SELECTED_CHECKIN =
    "shortcutsWidgetOnServiceSelectedCheckin";

  events.ON_APPOINTMENT_REBOOK = "shortcutsWidgetOnAppointmentRebook";

  events.SEND_AVAILABILITY_REQUEST = "shortcutsWidgetOnSendAvailabilityRequest";
  events.RECEIVE_AVAILABILITY_RESPONSE =
    "shortcutsWidgetOnReceiveAvailabilityResponse";

  events.ON_BOOKING_TIME_SELECTED = "shortcutsWidgetOnBookingTimeSelected";
  events.ON_BOOKING_CLICK_ADD_SERVICE = "shortcutsWidgetOnClickAddService";
  events.ON_BOOKING_CLICK_REMOVE_SERVICE =
    "shortcutsWidgetOnClickRemoveService";
  events.ON_BOOKING_CHANGE_EMPLOYEE = "shortcutsWidgetOnBookingChangeEmployee";
  events.ON_BOOKING_CONFIRMATION_BACK = "shortcutsWidgetOnBookingConfirmBack";
  events.ON_BOOKING_CONFIRMATION_CONFIRMED = "shortcutsWidgetOnBookingConfirm";

  events.ON_BOOKING_LOAD_AVAILABILITIES = "shortcutsWidgetOnBookingLoadAppts"; // fired when request for availabilities is complete.
  events.ON_BOOKING_RENDER_AVAILABILITIES =
    "shortcutsWidgetOnBookingRenderAppts"; // fired when availabilities have been rendered to the page.
  events.ON_BOOKING_REQUEST_ALTERNATIVES =
    "shortcutsWidgetOnBookingRequestAlts"; // fired when request for alternatives is started.
  events.ON_BOOKING_LOAD_ALTERNATIVES = "shortcutsWidgetOnBookingLoadAlts"; // fired when request for alternatives is complete.
  events.ON_BOOKING_RENDER_ALTERNATIVES = "shortcutsWidgetOnBookingRenderAlts";
  events.ON_BOOKING_CLICK_GO_TO_ALTERNATIVE = "shortcutsWidgetOnBookingGoToAlt"; // fired when user clicks on the date that specifies the first free alternative appointment.

  events.ON_EMPLOYEE_SELECTED_BOOKING = "shortcutsWidgetOnEmployeeSelected";
  events.ON_EMPLOYEE_SELECTED_CHECKIN =
    "shortcutsWidgetOnEmployeeSelectedCheckin";

  events.ON_CHECKIN_REBOOK = "shortcutsWidgetOnCheckinRebook";
  events.ON_CHECKIN_CANCELLED = "shortcutsWidgetOnCheckinCancelled";
  events.ON_CHECKIN_DELAY_SELECTED = "shortcutsWidgetOnDelaySelected";
  events.ON_CHECKIN_DELAY_BACK = "shortcutsWidgetOnDelayBack";

  events.ON_SPECIAL_SELECTED = "shortcutsWidgetOnSpecialSelected";

  events.trigger = function (widget, name, data) {
    var $fireEl, fireData, event;

    fireData = {};
    $fireEl = $(document);
    if (widget) {
      fireData.widget = widget;
      if (widget.$el) $fireEl = widget.$el;
    }

    sw.vendor._.extend(fireData, data);
    event = $.Event(name);
    $fireEl.trigger(event, [fireData]);
    return event.result !== false;
  };

  // This helps backwards compatibility with old editions of the Salon App.
  sw.EventDispatcher = {
    on: function (name, fn, context) {
      $(document).on(name, fn.bind(context));
    },
  };

  // Resize events for widgets
  $(window)
    .off("resize.sw")
    .on("resize.sw", function () {
      sw.cache.widgetCache.each(function (widget) {
        widget.resize.call(widget);
      });
    });
})(this);

(function (root) {
  var sw = root.shortcuts.widgets;
  sw.util = {
    /**
     * Formats a time to be displayed in the current locale.
     * @param {string} The time as an ISO Datetime string
     * @returns {string} The time as an html string.
     */
    formatTime: function (time) {
      return sw.vendor.moment(time, "HH:mm:ss").format("LT");
    },
    formatText: function () {
      var s = arguments[0];
      for (var i = 0; i < arguments.length - 1; i++) {
        var reg = new RegExp("\\{" + i + "\\}", "gm");
        s = s.replace(reg, arguments[i + 1]);
      }

      return s;
    },
    formatDuration: function (interval, value) {
      if (!interval) throw "Interval required";
      if (interval.toLowerCase() === "m")
        return sw.vendor.moment.duration.fromIsoduration(value).asMinutes();
      throw "Interval not implemented";
    },

    /**
     * Gets a link object from a links collection.
     * @param links {array} Links on the model.
     * @param rel {string} Name of rel property.
     * @returns {object}
     */
    getLink: function (links, rel) {
      var i;
      for (i = 0; i < links.length; i++) {
        if (links[i].rel === rel) {
          return links[i];
        }
      }
    },

    /**
     * Converts hash of properties to a URL query string.
     * @param {object} hash Pojo of key value pairs to convert to a query string.
     * @returns {string} has converted to a query string.
     */
    toQueryString: function (hash) {
      var key, params;

      params = [];
      for (key in hash) {
        if (!hash.hasOwnProperty(key)) {
          continue;
        }
        params.push(key + "=" + hash[key].toString());
      }

      return "?" + params.join("&");
    },

    /**
     * Rounds a number to the nearest multiple of another number.
     * @param value {number} The number to round
     * @param factor {number} Round to multiples of this number.
     * @param roundDirection {string} How to round the number.  Possible values: "up", "down", "closest".  Defaults to "closest"
     * @returns {number} The rounded number.
     */
    roundToMultiple: function (value, factor, roundDirection) {
      switch (roundDirection) {
        case "up":
          return Math.ceil(value / factor) * factor;
        case "down":
          return Math.floor(value / factor) * factor;
        case "closest":
        default:
          return Math.round(value / factor) * factor;
      }
    },

    /**
     * Gets a customer relationship object from customer.
     * @param customer {object}
     * @param selected_customer_href {string}
     * @returns {object}
     */
    getCustomerRelationshipsViewModel: function (
      customer,
      selected_customer_href,
      linkNewClienString
    ) {
      var customerRelationshipsViewModel;
      customerRelationshipsViewModel = [];
      if (
        customer !== null &&
        typeof customer.href !== "undefined" &&
        customer.href !== null
      ) {
        customerRelationshipsViewModel.push({
          display_name: customer.first_name + " " + customer.last_name,
          href: customer.href,
          isSelected: this.isCustomerSelected(
            selected_customer_href,
            customer.href,
            true
          ),
        });

        for (i = 0; i < customer.customer_relationships.length; i++) {
          var relatedCustomer = customer.customer_relationships[i];

          customerRelationshipsViewModel.push({
            display_name:
              relatedCustomer.first_name + " " + relatedCustomer.last_name,
            href: relatedCustomer.links[0].href,
            isSelected: this.isCustomerSelected(
              selected_customer_href,
              relatedCustomer.links[0].href,
              false
            ),
          });
        }
      }
      customerRelationshipsViewModel.sort(function (a, b) {
        var aName = a.display_name.toLowerCase();
        var bName = b.display_name.toLowerCase();
        return aName.localeCompare(bName);
      });

      customerRelationshipsViewModel.unshift({
        display_name: linkNewClienString,
        href: "",
        isSelected: false,
      });

      return customerRelationshipsViewModel;
    },

    isCustomerSelected: function (selectedCustomerHref, customerHref, isOwner) {
      var selectedCustomerId, customerId;
      if (
        typeof selectedCustomerHref === "undefined" ||
        selectedCustomerHref === null
      )
        return isOwner ? true : false;

      selectedCustomerId = selectedCustomerHref.substr(
        selectedCustomerHref.indexOf("customer") + 9,
        selectedCustomerHref.length
      );
      customerId = customerHref.substr(
        customerHref.indexOf("customer") + 9,
        customerHref.length
      );

      return selectedCustomerId === customerId;
    },
  };
})(this);
(function (root) {
  var sw = root.shortcuts.widgets;
  sw.style = {
    ".sw-hidden": {
      display: "none !important",
    },
    ".sw-datepicker .datepick-rtl": {
      direction: "rtl",
    },
    ".sw-datepicker .datepick-popup": {
      zIndex: "1000",
    },
    ".sw-datepicker .datepick-disable": {
      position: "absolute",
      zIndex: "100",
      opacity: "0.5",
    },
    ".sw-datepicker .datepick a": {
      textDecoration: "none",
    },
    ".sw-datepicker .datepick a.datepick-disabled, .sw-datepicker  .datepick-month td span, .sw-datepicker .datepick-month-nav span":
      {
        opacity: "0.5",
        cursor: "auto",
      },
    ".sw-datepicker .datepick-nav *, .sw-datepicker .datepick-ctrl *": {
      float: "left",
      padding: "5px 2%",
    },
    ".sw-datepicker .datepick-nav": {
      textAlign: "center",
      verticalAlign: "bottom",
    },
    ".sw-datepicker .datepick-cmd-prev, .sw-datepicker .datepick-cmd-next": {
      margin: "0 px",
    },
    ".sw-datepicker .datepick-cmd-prev, .sw-datepicker .datepick-cmd-prevJump, .sw-datepicker .datepick-cmd-clear":
      {
        float: "left",
      },
    ".sw-datepicker .datepick-cmd-next, .sw-datepicker .datepick-cmd-nextJump, .sw-datepicker .datepick-cmd-close":
      {
        float: "right",
        textAlign: "right",
      },
    ".sw-datepicker .datepick-rtl .datepick-cmd-prev, .sw-datepicker .datepick-rtl .datepick-cmd-prevJump, .sw-datepicker .datepick-rtl .datepick-cmd-clear":
      {
        float: "right",
        textAlign: "right",
      },
    ".sw-datepicker .datepick-rtl .datepick-cmd-next, .sw-datepicker .datepick-rtl .datepick-cmd-nextJump, .sw-datepicker .datepick-rtl .datepick-cmd-close":
      {
        float: "left",
        textAlign: "left",
      },
    ".sw-datepicker .datepick-cmd-today": {
      float: "none",
      position: "relative",
      top: "5px",
    },
    ".sw-datepicker .datepick-month-nav": {
      float: "left",
      textAlign: "center",
    },
    ".sw-datepicker .datepick-month-nav div": {
      float: "left",
      width: "12.5%",
      margin: "1%",
      padding: "1%",
    },
    ".sw-datepicker .datepick-month-row": {
      clear: "left",
    },
    ".sw-datepicker .datepick-month": {
      float: "left",
      border: "0",
      width: "100%",
      textAlign: "center",
    },
    ".sw-datepicker .datepick-month-header select": {
      display: "inline !important",
      padding: "0 2.6rem 0 0",
    },
    ".sw-datepicker .datepick-month-header select, .sw-datepicker .datepick-month-header input":
      {
        width: "auto",
      },
    ".sw-datepicker .datepick-month-header input": {
      position: "absolute",
      display: "none",
    },
    ".sw-datepicker .datepick-month table": {
      width: "98%",
      margin: "1%",
      borderSpacing: "1px",
      tableLayout: "fixed",
    },
    ".sw-datepicker .datepick-month th, .sw-datepicker .datepick-month td": {
      margin: "0",
      padding: "0",
      fontWeight: "normal",
      textAlign: "center",
    },
    ".sw-datepicker .datepick-month th": {
      border: "none",
    },
    ".sw-datepicker .datepick-month td.datepick-week *": {
      border: "none",
    },
    ".sw-datepicker .datepick-month a, .sw-datepicker .datepick-month span": {
      display: "block",
      width: "100%",
      padding: "0.5rem 0",
      textDecoration: "none",
    },
    ".sw-datepicker .datepick-status": {
      clear: "both",
      textAlign: "center",
    },
    ".sw-datepicker .datepick-clear-fix": {
      clear: "both",
    },
    ".sw-datepicker": {
      backgroundColor: "#353731",
      width: "100% !important",
      maxWidth: "300px !important",
    },
    ".sw-datepicker a, .sw-datepicker span": {
      color: "#e4dcd0",
    },
    ".sw-datepicker .datepick-cmd:not(.datepick-disabled), .sw-datepicker .datepick-month td .datepick-highlight":
      {
        transition: "box-shadow 1s",
        mozTransition: "-moz-box-shadow 1s, box-shadow 1s",
        webkitTransition: "-webkit-box-shadow 1s, box-shadow 1s",
        boxShadow: "inset 0 0 0 9999rem rgba(199, 206, 171, 0)",
        mozBoxShadow: "inset 0 0 0 9999rem rgba(199, 206, 171, 0)",
        webkitBoxShadow: "inset 0 0 0 9999rem rgba(199, 206, 171, 0)",
      },
    ".sw-datepicker .datepick-cmd:not(.datepick-disabled):hover, .sw-datepicker .datepick-month td .datepick-highlight:hover":
      {
        backgroundColor: "#7b9758",
        color: "#e4dcd0",
      },
    ".sw-datepicker .datepick-cmd:not(.datepick-disabled):active, .sw-datepicker .datepick-month td .datepick-highlight:active":
      {
        transition: "none",
        mozTransition: "none",
        webkitTransition: "none",
        boxShadow: "inset 0 0 0 9999rem #c7ceab",
        mozBoxShadow: "inset 0 0 0 9999rem #c7ceab",
        webkitBoxShadow: "inset 0 0 0 9999rem #c7ceab",
      },
    ".sw-datepicker .datepick-month a": {
      backgroundColor: "rgba(0, 0, 0, 0.3)",
    },
    ".sw-datepicker .datepick-month td .datepick-other-month": {
      backgroundColor: "transparent",
    },
    ".sw-datepicker .datepick-month td .datepick-today": {
      backgroundColor: "#474f32",
      color: "#e4dcd0",
    },
    ".sw-datepicker .datepick-month td .datepick-selected": {
      backgroundColor: "#7b9758",
      color: "#e4dcd0",
    },
    ".sw-datepicker .datepick-month-header": {
      backgroundColor: "#474f32",
    },
  };
  if (sw.getAppSetting("defaultStylesEnabled")) {
    sw.createStyleSheet(true);
    sw.addStyles(null, sw.style);
  }
})(this);
(function (root) {
  var sw,
    cache,
    widgetCache,
    stateCache,
    keyValueItem,
    factory,
    ensureSiteCache;
  sw = root.shortcuts.widgets;
  cache = sw.cache = {};
  widgetCache = {};
  stateCache = {};
  keyValueItem = function (key, value, index) {
    this.key = key;
    this.value = value;
    this.index = index;
    this.createdAt = new Date().getTime();
  };
  factory = {
    get: function (key, duration, cache) {
      var item, slidingTimeWindow;
      item = cache[key];
      if (item) {
        if (duration) {
          slidingTimeWindow = new Date().getTime() - item.createdAt;
          if (slidingTimeWindow > duration.asMilliseconds()) {
            this.remove(key, cache);
            return null;
          }
        }
        return item.value;
      }

      return null;
    },
    set: function (key, value, cache) {
      var item;
      item = cache[key] = new keyValueItem(
        key,
        value,
        sw.vendor._.keys(cache).length + 1
      );
      return item.value;
    },
    remove: function (key, cache) {
      delete cache[key];
    },
    each: function (cache, iterator, reverse, siteId) {
      if (!reverse) {
        sw.vendor._.each(cache, function (item, key, list) {
          iterator(item.value, key, list, siteId);
        });
        return;
      }
      sw.vendor._.each(
        sw.vendor._.sortBy(
          sw.vendor._.map(cache, function (value, key, list) {
            return { item: value, key: key, list: list };
          }),
          function (m) {
            return m.item.index * -1;
          }
        ),
        function (value, key, list) {
          iterator(value.item.value, value.item.key, list, siteId);
        }
      );
    },
  };

  ensureSiteCache = function (siteId, parentCache, key) {
    // "customer" is a special-case cache item which is stored at the company level, not the
    // site level. Do that transparently here by making the company URL the so-called "site ID"
    // we will cache at. That way, we'll support sharing customer details among multiple sites
    // across the same company, without widgets needing to change their behaviour.
    if (key === "customer") {
      var site = cache.stateCache.get(siteId, "site");
      if (!site.company_url) throw "Site details not in widget cache yet!";

      siteId = site.company_url;
    }

    return (parentCache[siteId] = parentCache[siteId] || {});
  };

  cache.widgetCache = {
    get: function (siteId, key, duration) {
      return factory.get(key, duration, ensureSiteCache(siteId, widgetCache));
    },
    set: function (siteId, key, value) {
      return factory.set(key, value, ensureSiteCache(siteId, widgetCache));
    },
    remove: function (siteId, key) {
      factory.remove(key, ensureSiteCache(siteId, widgetCache));
    },
    each: function (siteId, iterator) {
      // If we are only passed an iterator, then go through all widgets in all
      // sites.
      if (arguments.length === 1) {
        iterator = siteId;
        for (var anySiteId in widgetCache) {
          if (widgetCache.hasOwnProperty(anySiteId)) {
            factory.each(
              ensureSiteCache(anySiteId, widgetCache),
              iterator,
              true,
              anySiteId
            );
          }
        }
        return;
      }

      factory.each(
        ensureSiteCache(siteId, widgetCache),
        iterator,
        true,
        siteId
      );
    },
  };
  cache.stateCache = {
    get: function (siteId, key, duration) {
      var state;
      state = factory.get(
        key,
        duration,
        ensureSiteCache(siteId, stateCache, key)
      );
      if (!state)
        return factory.set(key, {}, ensureSiteCache(siteId, stateCache, key));
      return state;
    },
    set: function (siteId, key, value) {
      return factory.set(key, value, ensureSiteCache(siteId, stateCache, key));
    },
    remove: function (siteId, key) {
      factory.remove(key, ensureSiteCache(siteId, stateCache, key));
    },
    each: function (siteId, iterator) {
      // If we are only passed an iterator, then go through all widgets in all
      // sites.
      if (arguments.length === 1) {
        iterator = siteId;
        for (var anySiteId in stateCache) {
          if (stateCache.hasOwnProperty(anySiteId)) {
            factory.each(
              ensureSiteCache(anySiteId, stateCache),
              iterator,
              true,
              anySiteId
            );
          }
        }
        return;
      }

      factory.each(
        ensureSiteCache(siteId, stateCache),
        iterator,
        false,
        siteId
      );
    },
  };
})(this);
(function (root) {
  var sw, handlers, buildMessageDialogComponent;
  sw = root.shortcuts.widgets;
  handlers = sw.handlers = {};
  buildMessageDialogComponent = function (id) {
    var messageDialog,
      messageDialogContent,
      messageDialogTitle,
      messageDialogMessage,
      messageDialogActionBar;
    messageDialog = $(document.createElement("div"))
      .attr("data-sw-id", id)
      .addClass("sw-message-dialog")
      .css({ position: "relative", zIndex: "100" });
    messageDialogContent = $(document.createElement("div"))
      .addClass("sw-message-dialog-content")
      .css({
        position: "absolute",
        left: "0",
        right: "0",
        backgroundColor: "#FFFFFF",
        border: "1px solid #CCCCCC",
      });
    messageDialogTitle = $(document.createElement("div"))
      .addClass("sw-message-dialog-title")
      .css({ padding: "5px", fontWeight: "bold" });
    messageDialogMessage = $(document.createElement("div"))
      .addClass("sw-message-dialog-message")
      .css({ padding: "5px" });
    messageDialogActionBar = $(document.createElement("div"))
      .addClass("sw-message-dialog-action-bar")
      .css({
        padding: "5px",
        textAlign: "right",
        backgroundColor: "rgba(204,204,204, 0.2)",
      });
    messageDialogContent.append(messageDialogTitle);
    messageDialogContent.append(messageDialogMessage);
    messageDialogContent.append(messageDialogActionBar);
    messageDialog.append(messageDialogContent);
    return messageDialog;
  };
  handlers.onBeginRequest = function () {
    sw.events.trigger(this, sw.events.WIDGET_AJAX_BEGIN);
  };
  handlers.onEndRequest = function () {
    sw.events.trigger(this, sw.events.WIDGET_AJAX_END);
  };
  handlers.loadNewWidget = function (path, $el, options) {
    var defaults,
      opts,
      deferred,
      widgetElSetting,
      widgetBackHistory,
      resumeHandlers,
      newWidgetSiteId,
      widget,
      recycleWidget,
      getWidgetFile,
      defaultWidgetInitArgs;

    defaultWidgetInitArgs = sw.getWidgetSpecificAppSetting(
      "widgetInitArgs",
      path
    );
    if (!defaultWidgetInitArgs) defaultWidgetInitArgs = {};

    defaults = {
      resume: false,
      load: true,
      initArgs: {},
    };
    opts = sw.vendor._.extend(defaults, options);
    sw.vendor._.defaults(opts.initArgs, defaultWidgetInitArgs);

    resumeHandlers = [];
    if (this.resumeHandlers) resumeHandlers = this.resumeHandlers;
    if (this.$el && opts.resume && !opts.isResuming) {
      resumeHandlers.push({
        path: this.path,
        $el: this.$el,
        resumeArgs: opts.resumeArgs,
      });
    }

    widgetBackHistory = [];
    if (this.widgetBackHistory) widgetBackHistory = this.widgetBackHistory;

    // By default, new widgets inherit the siteId of the widget that calls us.
    // The getAppSetting() call is for back-compat with the old way of setting the site id
    // (ie. globally through the widget api init() call)
    newWidgetSiteId = opts.siteId || this.siteId || sw.getAppSetting("siteId");

    recycleWidget = false;
    widgetElSetting = sw.getWidgetSpecificAppSetting("widgetEl", path);
    if (widgetElSetting) {
      $el = widgetElSetting;

      // Check if the widget we're requesting is already in this $el.
      // If so, then to prevent flickering, we reuse that widget.
      widget = sw.cache.widgetCache.get(newWidgetSiteId, path);
      if (widget && $el.is(widget.$el)) {
        recycleWidget = true;
      }
    }

    deferred = $.Deferred();

    if (recycleWidget) {
      // Widget already downloaded and inited
      getWidgetFile = $.Deferred().resolve();
    } else {
      $el = $el || this.$el;

      sw.cache.widgetCache.each(function (widget, key, list, siteId) {
        if (widget.$el.closest($el).length !== 0) {
          widget.close();
          sw.cache.widgetCache.remove(siteId, key);
        }
      });

      getWidgetFile = sw.handlers
        .getApiUrl("widget", path)
        .then(function (url) {
          return $.ajax(url);
        })
        .then(function (data) {
          sw._currentEl = $el;
          sw._currentPath = path;
          sw._currentSiteId = newWidgetSiteId;

          // Apply the widget to the page. Anything in script tags is called immediately
          $el.css("visibility", "hidden");
          $el.html(data);

          delete sw._currentEl;
          delete sw._currentPath;
          delete sw._currentSiteId;

          widget = sw.cache.widgetCache.get(newWidgetSiteId, path);
          if (!widget)
            throw (
              "Widget '" +
              path +
              "' not initialised properly. Was registerWidget() not called? A syntax error in the widget?"
            );

          widget.widgetBackHistory = widgetBackHistory;
          widget.resumeHandlers = resumeHandlers;

          return sw.ensureSiteDetailsInCache(newWidgetSiteId);
        });
    }

    getWidgetFile
      .then(function () {
        sw.events.trigger(widget, sw.events.WIDGET_LOADING);
      })
      .done(function () {
        if (sw.vendor._.isFunction(widget.initialize))
          widget.initialize.call(widget, opts.initArgs || {});

        if (opts.isResuming) {
          widget.onResume(opts.resumeArgs);
          $el.css("visibility", "");
          deferred.resolve(widget);
        } else if (opts.load) {
          widget
            .load()
            .done(function () {
              var widgetBackSetting, widgetHistoryItem;
              if (!widget.isClosed) {
                // Push a new back button entry
                if (!recycleWidget && !opts.isGoingBack) {
                  if (
                    widgetBackHistory.length > 0 &&
                    widgetBackHistory[widgetBackHistory.length - 1]
                      .clearOnAddition
                  ) {
                    // When the previous widget is clearOnAddition, remove all history entries before it
                    widgetBackHistory.splice(0, widgetBackHistory.length - 1);
                  }

                  // Only push a history entry if a widget will render. That way we exclude
                  // widgets that redirect themselves
                  widgetBackSetting = widget.getBackSetting();
                  widgetHistoryItem = {
                    path: path,
                    initArgs: opts.initArgs,
                    backSetting: widgetBackSetting,
                  };
                  switch (widgetBackSetting) {
                    case sw.BACK_CLEAR_PREVIOUS:
                      widgetBackHistory.splice(
                        0,
                        widgetBackHistory.length,
                        widgetHistoryItem
                      );
                      break;
                    case sw.BACK_CLEAR_PREVIOUS_UPON_ADDITION:
                      // Find any previous clearOnAddition widget and remove it, plus any entries before it
                      var i = widgetBackHistory.length - 1;
                      for (; i >= 0; i--) {
                        if (widgetBackHistory[i].clearOnAddition) break;
                      }
                      widgetBackHistory.splice(0, i + 1);
                      widgetBackHistory.push(
                        sw.vendor._.extend(widgetHistoryItem, {
                          clearOnAddition: true,
                        })
                      );
                      break;
                    case sw.BACK_NORMAL:
                      widgetBackHistory.push(widgetHistoryItem);
                      break;
                  }
                }

                widget.render();
              }
              deferred.resolve(widget);
            })
            .fail(function () {
              deferred.reject.apply(deferred, arguments);
            })
            .always(function () {
              $el.css("visibility", "");
              widget.onLoadComplete();
            });
        } else {
          deferred.resolve(widget);
        }
      })
      .fail(function () {
        deferred.reject.apply(deferred, arguments);
      });

    return deferred.promise();
  };
  handlers.onDone = function () {
    var resumeHandler;
    if (!this.resumeHandlers || this.resumeHandlers.length === 0) {
      sw.events.trigger(this, sw.events.WIDGET_DONE);
      return;
    }
    resumeHandler = this.resumeHandlers.pop();
    this.loadNewWidget(resumeHandler.path, resumeHandler.$el, {
      isResuming: true,
      resumeArgs: resumeHandler.resumeArgs,
    });
  };
  handlers.onLoadComplete = function () {
    sw.events.trigger(this, sw.events.WIDGET_RENDERED);
  };
  handlers.showAlert = function (message, title, buttonText) {
    var deferred, messageDialog, messageDialogActionBar, messageDialogButton;
    deferred = $.Deferred();
    message = message.replace(/\n/g, "<br>");
    title = title || sw.strings.alert;
    buttonText = buttonText || sw.strings.ok;
    messageDialog = this.$el.find(
      "div.sw-message-dialog[data-sw-id='" + this.path + "']"
    );
    if (messageDialog.length === 0) {
      messageDialog = buildMessageDialogComponent(this.path);
      messageDialogActionBar = messageDialog.find(
        ".sw-message-dialog-action-bar"
      );
      messageDialogButton = $(document.createElement("button"))
        .css({ pointerEvents: "auto" })
        .click(
          (function ($el, messageDialog, deferred) {
            return function () {
              messageDialog
                .find(".sw-message-dialog-action-bar > button")
                .unbind("click");
              messageDialog.remove();
              $el.css({ pointerEvents: "auto" });
              deferred.resolve();
            };
          })(this.$el, messageDialog, deferred)
        );
      messageDialogActionBar.append(messageDialogButton);
      this.$el.css({ pointerEvents: "none" }).prepend(messageDialog);
    }
    messageDialog.find(".sw-message-dialog-title").html(title);
    messageDialog.find(".sw-message-dialog-message").html(message);
    messageDialog
      .find(".sw-message-dialog-action-bar > button")
      .html(buttonText);
    return deferred.promise();
  };
  handlers.showConfirm = function (message, title, confirmText, cancelText) {
    var deferred,
      messageDialog,
      messageDialogActionBar,
      messageDialogConfirmButton,
      messageDialogCancelButton;
    deferred = $.Deferred();
    message = message.replace(/\n/g, "<br>");
    title = title || sw.strings.alert;
    confirmText = confirmText || sw.strings.yes;
    cancelText = cancelText || sw.strings.no;
    messageDialog = this.$el.find(
      "div.sw-message-dialog[data-sw-id='" + this.path + "']"
    );
    if (messageDialog.length === 0) {
      messageDialog = buildMessageDialogComponent(this.path);
      messageDialogActionBar = messageDialog.find(
        ".sw-message-dialog-action-bar"
      );
      messageDialogConfirmButton = $(document.createElement("button"))
        .attr("data-sw-role", "confirm")
        .css({ marginLeft: "5px", pointerEvents: "auto" })
        .click(
          (function ($el, messageDialog, deferred) {
            return function () {
              messageDialog
                .find(".sw-message-dialog-action-bar > button")
                .unbind("click");
              messageDialog.remove();
              $el.css({ pointerEvents: "auto" });
              deferred.resolve();
            };
          })(this.$el, messageDialog, deferred)
        );
      messageDialogCancelButton = $(document.createElement("button"))
        .attr("data-sw-role", "cancel")
        .css({ marginLeft: "5px", pointerEvents: "auto" })
        .click(
          (function ($el, messageDialog, deferred) {
            return function () {
              messageDialog
                .find(".sw-message-dialog-action-bar > button")
                .unbind("click");
              messageDialog.remove();
              $el.css({ pointerEvents: "auto" });
              deferred.reject();
            };
          })(this.$el, messageDialog, deferred)
        );
      messageDialogActionBar.append(messageDialogConfirmButton);
      messageDialogActionBar.append(messageDialogCancelButton);
      this.$el.css({ pointerEvents: "none" }).prepend(messageDialog);
    }
    messageDialog.find(".sw-message-dialog-title").html(title);
    messageDialog.find(".sw-message-dialog-message").html(message);
    messageDialog
      .find(".sw-message-dialog-action-bar > button[data-sw-role='confirm']")
      .html(confirmText);
    messageDialog
      .find(".sw-message-dialog-action-bar > button[data-sw-role='cancel']")
      .html(cancelText);
    return deferred.promise();
  };
  handlers.isConnectedToInternet = function () {
    return navigator.onLine;
  };
  handlers.getGeolocationPosition = function () {
    return $.Deferred().reject();
  };
  handlers.getApiUrl = function (section, endpoint) {
    var result, _this;

    _this = this;
    if (endpoint && endpoint.charAt(0) != "/") endpoint = "/" + endpoint;
    else if (!endpoint) endpoint = "";

    switch (section) {
      case "site":
        result = sw.getApiUrl() + "/site/" + this.siteId;
        break;
      case "company":
        result = this.getState("site").company_url;
        break;
      case "widget":
        result = sw.getWidgetUrl();
        if (endpoint) endpoint += ".html";
        break;
      case "customer_session":
        var customer;
        customer = this.getState("customer");
        // check expiry date
        if (customer.href) {
          result = customer.href;
        } else {
          // If we have a third-party access token, log in using that
          if (
            sw.getAppSetting("accessToken") &&
            sw.getAppSetting("accessTokenType")
          ) {
            var accessTokenDeferred = $.Deferred();
            callLoginEndpoint(this, {
              credential_type_code: "access_token",
              access_token: sw.getAppSetting("accessToken"),
              token_type: sw.getAppSetting("accessTokenType"),
            })
              .done(function () {
                accessTokenDeferred.resolve(
                  _this.getState("customer").href + endpoint
                );
              })
              .fail(accessTokenDeferred.reject);
            return accessTokenDeferred;
          } else {
            // No login found, reject the whole thing
            return $.Deferred().reject();
          }
        }
        break;
    }

    if (endpoint) result += endpoint;

    return $.Deferred().resolve(result);
  };

  handlers.IsSingleSignOn = function () {
    // Checking if it SSO third party access token
    if (
      sw.getAppSetting("accessToken") &&
      sw.getAppSetting("accessTokenType")
    ) {
      return true;
    }

    return false;
  };

  /**
   * Delete log-in information so can no longer access customer_session.
   */
  handlers.doCustomerLogout = function () {
    var sw, _this, mainPromise, facebookPromise;
    sw = shortcuts.widgets;
    _this = this;

    mainPromise = _this.getApiUrl("customer_session").then(function (url) {
      return _this.signedDelete(url);
    });

    // Customers are stored in a special way that "each" won't catch, so remove it separately
    sw.cache.stateCache.remove(this.siteId, "customer");

    // Remove everything from state cache except stuff the app uses prior to login
    sw.cache.stateCache.each(this.siteId, function (item, key) {
      if (key !== "site" && key !== "had_site") {
        sw.cache.stateCache.remove(this.siteId, key);
      }
    });

    facebookPromise = new $.Deferred();

    // If logged in via facebook, delete token for that too.
    sw.vendor.openFB.logout(function () {
      facebookPromise.resolve();
    });

    return $.when(mainPromise, facebookPromise.promise());
  };

  handlers.doCustomerLogin = function (
    username,
    password,
    credential_type,
    options
  ) {
    var widget, requestData;
    widget = this;
    requestData = {};
    requestData.credential_type_code = credential_type || "password";

    if (requestData.credential_type_code === "facebook") {
      requestData.facebook_id = username;
      requestData.facebook_token = password;

      if (options && options.email) {
        requestData.username = options.email;
      }
    } else {
      requestData.username = username;
      requestData.password = password;
    }

    return callLoginEndpoint(widget, requestData)
      .then(null, function (jqXHR) {
        // If we don't get any response (ie. a dropped connection) then try again.
        // This works around possible iOS 8 SSL+POST bug
        if (jqXHR.responseText) return jqXHR;
        else return callLoginEndpoint(widget, requestData);
      })
      .then(null, function (jqXHR) {
        var error = {};
        error.status = jqXHR.status;

        try {
          sw.vendor._.extend(error, JSON.parse(jqXHR.responseText));
        } catch (ex) {}

        if (error.status === 500) {
          if (error.sub_codes && error.sub_codes.length > 0) {
            if (
              sw.vendor._.find(error.sub_codes, function (subCode) {
                return subCode === "duplicate_login_client_in_database";
              })
            ) {
              jqXHR.global = false;
              if (sw.getEnableRegistrationCode() === true) {
                if (requestData.credential_type_code === "facebook") {
                  widget.setState("facebook_user_details", {
                    facebook_id: requestData.facebook_id,
                    facebook_token: requestData.facebook_token,
                  });
                }

                widget.setState("user", {
                  first_name: requestData.first_name,
                  last_name: requestData.last_name,
                  gender: requestData.gender,
                  email: requestData.username,
                });

                widget.sendRegistrationCode().done(function () {
                  widget.loadNewWidget("customer/link-accounts");
                });
              } else {
                widget.showAlert(
                  sw.strings.cannotUseFaceBookLoginError,
                  sw.strings.cannotUseFaceBookLoginErrorTitle
                );
                widget.onEndRequest();
              }
            }
          } else if (
            error.error_type_code &&
            error.error_type_code === "authorization" &&
            requestData.credential_type_code === "facebook"
          ) {
            widget.showAlert(
              sw.strings.invalidLoginCredentials,
              sw.strings.cannotUseFaceBookLoginErrorTitle
            );
            widget.onEndRequest();
          }
        }

        return jqXHR;
      });
  };

  function callLoginEndpoint(widget, requestData) {
    // If within the salon app, add the device's id to the request data
    if ("device" in window && window.device.uuid) {
      requestData = sw.vendor._.extend({}, requestData, {
        device_uuid: window.device.uuid,
      });
    }
    var loginEmail = requestData.username;

    return widget
      .getApiUrl("company", "authenticate_customer")
      .then(function (url) {
        return widget.signedPost(url, requestData);
      })
      .then(function (data) {
        var displayImageDeferred = $.Deferred();
        if (requestData.credential_type_code === "facebook") {
          sw.vendor.openFB.api({
            path: "/me/picture",
            params: { redirect: "false", type: "large" },
            success: function (obj) {
              data.customer.facebook_display_image = obj.data.url;
              displayImageDeferred.resolve(data);
            },
            error: function (obj) {
              displayImageDeferred.resolve(data);
            },
          });
        } else {
          displayImageDeferred.resolve(data);
        }

        return displayImageDeferred.promise();
      })
      .pipe(function (data) {
        var provider;

        widget.setState(
          "customer",
          sw.vendor._.extend({}, data.customer, {
            href: data.href,
            expiry_utc_date_time: data.expiry_utc_date_time,
            olsCustomerId: data.customer.href.substring(
              data.customer.href.lastIndexOf("/") + 1,
              data.customer.href.length
            ),
            customerLoginEmail: loginEmail,
          })
        );

        var siteId = widget.siteId;

        var site = sw.cache.stateCache.get(siteId, "site");

        if (site.payment_provider_code === "Stripe") {
          provider = new widget._SCStripe(widget);
        } else if (site.payment_provider_code === "GlobalPaymentsIntegrated") {
          provider = new widget._SCOpenEdge(widget);
        } else if (site.payment_provider_code === "Ezidebit") {
          provider = new widget._SCEzidebit(widget);
        } else {
          return data;
        }

        var customerCache = widget.getState("customer");
        if (
          provider.isProviderSupported() &&
          (provider.isUpfrontPaymentEnabled(siteId) ||
            provider.isCancellationFeeEnabled(siteId) ||
            provider.isOnlinePaymentEnabled(siteId))
        ) {
          return provider
            .getCustomer(
              siteId,
              customerCache.olsCustomerId,
              customerCache.email
            )
            .then(function (data) {
              customerCache.last4Number = data.last4Number;
              customerCache.stripeCustomerId = data.stripeCustomerId;
              customerCache.defaultSource = data.defaultSource;
              customerCache.cardType = data.cardType;
            });
        } else {
          return data;
        }
      });
  }

  handlers.sendRegistrationCode = function () {
    var widget, user, fbUserDetails, isPasswordCredential, endpoint;
    widget = this;
    isPasswordCredential = true;
    user = widget.getState("user");
    fbUserDetails = widget.getState("facebook_user_details");

    if (
      sw.vendor._.isObject(fbUserDetails) &&
      !sw.vendor._.isEmpty(fbUserDetails)
    ) {
      isPasswordCredential = false;
    }

    // Facebook/third parties will use the new endpoint eventually, but for now keep using the old path.
    if (
      widget.getState("site").customer_card
        .is_duplicate_client_prevention_enabled &&
      isPasswordCredential
    ) {
      endpoint = "customer/register";
    } else if (sw.getEnableRegistrationCode() === true) {
      endpoint = "customer_registration_code";
    } else {
      var deferred = $.Deferred();
      deferred.resolve({});
      return deferred.promise();
    }

    return widget
      .getApiUrl("company", endpoint)
      .then(function (url) {
        var requestData = {};

        widget.onBeginRequest();
        if (isPasswordCredential) {
          requestData = {
            credential_type_code: "password",
            username: user.email,
          };
        } else {
          requestData = {
            credential_type_code: "facebook",
            username: user.email,
            facebook_id: fbUserDetails.facebook_id,
          };
        }

        // iOS bug. SSL POSTs must be sent again on failure as iOS may drop the first instantly.
        return widget.signedPost(url, requestData).then(null, function () {
          return widget.signedPost(url, requestData);
        });
      })
      .always(function () {
        widget.onEndRequest();
      });
  };

  handlers.openFacebookLogin = function () {
    var deferred = $.Deferred();
    var fbCallback = sw.getFacebookCallbackUrl();
    var _this = this;

    if (window.intel && window.intel.xdk.isxdk) {
      console.log(
        'Please make sure BOTH URLs are entered in Facebook\'s app settings under "Valid OAuth redirect URIs":\n' +
          "  " +
          fbCallback +
          "\n" +
          "  https://www.facebook.com/connect/login_success.html"
      );

      alert(
        "Facebook login doesn't work in the XDK. Test by creating a build then installing it on a device."
      );
      deferred.reject({ status: "openFB not available" });
      return;
    }

    sw.vendor.openFB.login(
      function (obj) {
        var result = {},
          onBeginRequest,
          onEndRequest;
        if (obj.status != "connected") {
          deferred.reject(obj);
          return;
        }

        if (sw.vendor._.isFunction(_this.onBeginRequest)) {
          onBeginRequest = _this.onBeginRequest;
          onEndRequest = _this.onEndRequest;
        } else {
          onBeginRequest = sw.handlers.onBeginRequest;
          onEndRequest = sw.handlers.onEndRequest;
        }
        onBeginRequest();

        result.token = obj.authResponse.token;
        sw.vendor.openFB.api({
          path: "/me",
          params: { fields: "id,first_name,last_name,gender,email" },
          success: function (obj) {
            onEndRequest();
            sw.vendor._.extend(result, obj);
            deferred.resolve(result);
          },
          error: function (obj) {
            onEndRequest();
            deferred.reject(obj);
          },
        });
      },
      { callbackUrl: fbCallback, scope: "public_profile,email" }
    );
    return deferred.promise();
  };

  /**
   * Hide container's back button if one exists.
   * @param {boolean} canGoBack true if button should be displayed, false otherwise.*
   */
  handlers.setCanGoBack = function (canGoBack) {};

  handlers.goBack = function () {
    var nextWidget;
    if (this.fromLoginError) {
      return false;
    }
    do {
      // Find the first history entry whose path does not match the path of the current
      // widget (which essentially means skip over our own history entry)
      if (this.widgetBackHistory.length === 0) return false;

      nextWidget = this.widgetBackHistory[this.widgetBackHistory.length - 1];
      if (nextWidget.path === this.path) {
        this.widgetBackHistory.pop();
      }
    } while (nextWidget.path === this.path);

    this.loadNewWidget(nextWidget.path, this.$el, {
      isGoingBack: true,
      initArgs: nextWidget.initArgs,
    });
    return true;
  };

  /**
   * Called by a widget whenever they need a login, but don't have one because getApiUrl failed or
   * a customer session endpoint failed.
   * @param jqXHR The jqXHR passed to the widget's fail() function, so we can turn off global errors
   * @param onResumeArgs The arguments to be passed to the onResume function
   */
  handlers.onLoginRequired = function (jqXHR, onResumeArgs) {
    if (jqXHR) jqXHR.global = false;

    this.loadNewWidget("customer/enter-email", null, {
      resume: true,
      resumeArgs: onResumeArgs,
      initArgs: { fromLoginError: true },
    });
  };

  handlers.getCustomerActiveLinkedCards = function (
    customerId,
    deferred,
    newCardNumber
  ) {
    var widget = this;
    widget
      .getApiUrl("company", "customer_card_numbers?customer_id=" + customerId)
      .pipe(function (url) {
        return widget
          .signedGet(url)
          .then(function (result) {
            if (result.card_records && result.card_records.length > 0) {
              var linkedCardNumbers = result.card_records.map(function (value) {
                return value.card_number;
              });
              return widget.lambdaAPIService("loyalty/get_subscribed", "POST", {
                siteId: widget.siteId,
                card_numbers: linkedCardNumbers,
              });
            } else {
              deferred.resolve();
            }
          })
          .then(
            function (result) {
              if (result.card_numbers && result.card_numbers.length > 0) {
                widget.loadNewWidget("loyalty/loyalty-detail", null, {
                  initArgs: {
                    linkedCardNumbers: result.card_numbers,
                    selectedCardNumber: newCardNumber,
                  },
                });
              } else {
                widget.onEndRequest();
                deferred.resolve();
              }
            },
            function (err) {
              deferred.reject();
            }
          );
      });
  };
})(this);

(function (root) {
  var sw, resource;
  sw = root.shortcuts.widgets;
  resource = sw.resource = {};
  resource.validation = {
    emailRegex:
      /[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?/,
    phoneRegex: /^[0-9 ()-]+$/,
  };
})(this);
(function (root) {
  var sw,
    bindings,
    _,
    setView,
    setEntity,
    validateEntity,
    findBoundElement,
    findBoundElements;
  sw = root.shortcuts.widgets;
  bindings = sw.bindings = {};
  _ = sw.vendor._;
  bindings.ValidationCallback = {
    onValidModel: function ($element) {
      if ($element.is(":radio") || $element.is(":checkbox")) {
        var parent = $element.parent();
        parent.last().siblings("span.sw-validation-error").remove();
      } else if ($element.parent().is(".sw-wrap")) {
        $element.parent().siblings("span.sw-validation-error").remove();
      } else $element.siblings("span.sw-validation-error").remove();
    },
    onInvalidModel: function ($element, errorMessage) {
      if ($element.parent().is(".sw-wrap")) {
        $element = $element.parent();
      }

      var $span = $element.siblings("span.sw-validation-error");
      if ($span.length === 0) {
        $span = $(document.createElement("span"));
        if ($element.is(":radio") || $element.is(":checkbox")) {
          var parent = $element.parent();
          parent.last().after($span);
        } else $element.after($span);
      }
      $span
        .css({ color: "red" })
        .text(errorMessage)
        .addClass("sw-validation-error");
    },
  };

  setView = function ($root, namespace, entity) {
    var selector, $elements, isArray;
    _.each(entity, function (value, key) {
      isArray = _.isArray(value) && !_.isUndefined(value.$template);
      if (key === "attributes") {
        setView($root, namespace, value);
      } else if (isArray || !_.isObject(value)) {
        selector = namespace + ":" + key;
        $elements = $root
          .find("[data-sw-bind='" + selector + "']")
          .addBack("[data-sw-bind='" + selector + "']");
        $elements.each(function (index, el) {
          var $el, actionAttr, actions, updateMethod, format, formattedValue;
          $el = $(el);

          if ($el.is(":checkbox") || $el.is(":radio")) {
            updateMethod = "checked";
          } else {
            updateMethod =
              $el.is("input") || $el.is("select") || $el.is("textarea")
                ? "val"
                : "text";
          }
          actionAttr = $el.attr("data-sw-bind-action");
          if (typeof actionAttr !== typeof undefined && actionAttr !== false) {
            actions = actionAttr.split(",");
            _.each(actions, function (action) {
              var keyValuePair, actionKey, actionValue, bool;
              keyValuePair = action.trim().split(":");
              if (keyValuePair.length === 2) {
                actionKey = keyValuePair[0].trim();
                actionValue = keyValuePair[1].trim();
                switch (actionKey) {
                  case "updateMethod":
                    updateMethod = actionValue;
                    break;
                  case "visibility":
                    bool = actionValue.toLowerCase();
                    if (bool === "true" && !value) $el.addClass("sw-hidden");
                    else if (bool === "false" && value)
                      $el.addClass("sw-hidden");
                    else $el.removeClass("sw-hidden");
                    break;
                }
              }
            });
          }

          if (updateMethod !== "none") {
            if (isArray) {
              $el.empty();
              _.each(value, function (item, index, arr) {
                var model, indexer;
                model = {};
                indexer = {};
                indexer["@index"] = index;
                model[key] = _.extend({}, item, indexer);

                if (typeof arr["r"] !== "undefined") {
                  model["r"] = arr["r"]; // TODO: temporary hack to have the locale strings available in the nested html template
                }
                $el.append(
                  bindings.DataBinder.compileTemplate(value.$template, model)
                );
              });
            } else if (
              typeof value !== typeof null &&
              typeof value !== typeof undefined
            ) {
              format = $el.attr("data-sw-format");

              if (format === "currency")
                formattedValue = sw.vendor.Globalize.format(value, "c");
              else if (format === "display_date") {
                var dateFormat = sw.settings.dateFormat;
                var val =
                  typeof dateFormat === "string"
                    ? sw.vendor.Globalize.format(
                        sw.vendor.moment(value, "YYYY-MM-DD").toDate(),
                        dateFormat
                      )
                    : dateFormat(value);
                formattedValue = val;
              } else if (format === "display_date_utc") {
                var dateFormat = sw.settings.dateFormat;
                var val =
                  typeof dateFormat === "string"
                    ? sw.vendor.Globalize.format(
                        sw.vendor.moment(value).toDate(),
                        dateFormat
                      )
                    : dateFormat(value);
                formattedValue = val;
              } else if (format === "date_time_utc") {
                formattedValue = sw.vendor.Globalize.format(
                  sw.vendor.moment(value + "+0000").format("dddd D MMMM LT")
                );
              } else if (format === "date_time") {
                formattedValue = sw.vendor.Globalize.format(
                  sw.vendor.moment(value).format("dddd D MMMM LT")
                );
              } else if (format === "time") {
                formattedValue = sw.vendor
                  .moment(
                    sw.vendor.moment().format("YYYY-MM-DD") + "T" + value,
                    sw.vendor.moment.ISO_8601
                  )
                  .format("LT");
                if (updateMethod === "text") updateMethod = "html";
              } else if (format === "duration_minutes")
                formattedValue = sw.vendor.moment.duration
                  .fromIsoduration(value)
                  .asMinutes();
              else if (format === "percentage") formattedValue = value + "%";
              else formattedValue = value;

              if (updateMethod === "checked") {
                $el.prop("checked", formattedValue);
              } else {
                $el[updateMethod](formattedValue);
              }
            }
          }
        });
        $elements = $root
          .find("[data-sw-attr*='" + selector + "']")
          .addBack("[data-sw-attr*='" + selector + "']");
        $elements.each(function (index, el) {
          var $el, attrPaths;
          $el = $(el);
          attrPaths = $($el).attr("data-sw-attr").split(",");
          _.each(attrPaths, function (attrPath) {
            var attr, attrVal;
            attrPath = attrPath.trim();
            attr = attrPath.substring(0, attrPath.indexOf(":")).trim();
            attrVal = attrPath.substring(attrPath.indexOf(":") + 1).trim();
            if (attrVal === selector) {
              $el.attr(attr, value);
            }
          });
        });
      }
    });
  };

  setEntity = function (entity, boundElements) {
    _.each(boundElements, function (element) {
      if ("attributes" in entity && element.key in entity.attributes)
        entity.attributes[element.key] = element.value;
      else if (element.key in entity) entity[element.key] = element.value;
    });
  };

  validateEntity = function (model, boundElements) {
    var isValid, i, validator, errorMessage;
    isValid = true;
    _.each(boundElements, function (element) {
      if (
        model.validation &&
        (validator = model.validation[element.key]) &&
        (errorMessage = validator(element.value, model))
      ) {
        isValid = false;
        if (errorMessage.msg) {
          bindings.ValidationCallback.onInvalidModel(
            element.$el,
            errorMessage.msg,
            errorMessage.isAlternative
          );
        } else {
          bindings.ValidationCallback.onInvalidModel(element.$el, errorMessage);
        }
      } else {
        bindings.ValidationCallback.onValidModel(element.$el);
      }
    });
    return isValid;
  };

  findBoundElement = function ($root, namespace, key) {
    var selector, $element, $elements, value;
    selector = namespace + ":" + key;
    $elements = $root.find("[data-sw-bind='" + selector + "']");
    $elements.each(function (index, el) {
      var $el, actionAttr, actions, updateMethod, valueMethod;
      $el = $(el);

      if ($el.is(":checkbox") || $el.is(":radio")) {
        $element = $el;
        value = $el.is(":checked");
        return false;
      } else {
        updateMethod =
          $el.is("input") || $el.is("select") || $el.is("textarea")
            ? "val"
            : "text";
        if (!$el.is(":hidden") || $el.attr("data-model") === "true") {
          actionAttr = $el.attr("data-sw-bind-action");
          if (typeof actionAttr !== typeof undefined && actionAttr !== false) {
            actions = actionAttr.split(",");
            actions = _.reduce(
              actions,
              function (memo, action) {
                var keyValuePair = action.trim().split(":");
                if (keyValuePair.length === 2) {
                  memo[keyValuePair[0].trim()] = keyValuePair[1].trim();
                }
                return memo;
              },
              {}
            );

            updateMethod = actions.updateMethod || updateMethod;
          } else {
            actions = {};
          }

          // A valueMethod can be specified to do something special when getting the value from the element.
          if (actions.valueMethod || updateMethod === "val") {
            $element = $el;
            value = ($el[actions.valueMethod] || $el[updateMethod])
              .call($el)
              .trim();
            return false;
          }
        }
      }
    });

    if (!_.isUndefined(value) && _.isObject($element))
      return { key: key, value: value, $el: $element };
    return null;
  };

  findBoundElements = function ($root, namespace, entity) {
    var boundElements, boundElement, attributes, attr;
    boundElements = [];
    _.each(entity, function (value, key) {
      if (key === "attributes") {
        _.each(entity[key], function (value, attr) {
          boundElement = findBoundElement($root, namespace, attr);
          if (boundElement) boundElements.push(boundElement);
        });
      } else if (!_.isObject(value)) {
        boundElement = findBoundElement($root, namespace, key);
        if (boundElement) boundElements.push(boundElement);
      }
    });
    return boundElements;
  };

  bindings.DataBinder = {
    compileTemplate: function (html, data) {
      var $root, $embedEl, templateName, templateHtml;
      $root = html instanceof jQuery ? html : $(html);

      // Find any elements that embed templates directly, eg. html from modules
      // This while-loop approach will let us support recursive embed elements
      while (true) {
        $embedEl = $root.find("[data-sw-embed]");
        if ($embedEl.length === 0) break;

        $embedEl = $embedEl.first();
        templateName = $embedEl.attr("data-sw-embed");
        templateHtml = $("script[data-sw-id='" + templateName + "']").html();
        $embedEl.after(templateHtml).remove();
      }

      _.each(data, function (entity, namespace) {
        setView($root, namespace, entity);
      });
      return $root;
    },
    updateModel: function ($root, data, options) {
      var opt, isValid, boundElements;
      isValid = true;
      opt = options || {};
      _.each(data, function (entity, namespace) {
        var cloned;
        boundElements = findBoundElements($root, namespace, entity);
        // Need to have all values on the model as sometimes we cannot validate in isolation.
        cloned = $.extend(true, entity, {});
        setEntity(cloned, boundElements);
        if (entity && entity.validation && opt.validate === true)
          isValid = validateEntity(cloned, boundElements);

        if (isValid) setEntity(entity, boundElements);
      });

      return isValid;
    },
    delegateEvents: function (widget) {
      var $root, events, keyParts, $element, handler;
      if (!widget.events) return;
      $root = widget.$el;
      events = widget.events;
      _.each(events, function (handler, key) {
        keyParts = key.trim().split(" ");
        if (keyParts.length == 2 && widget._.isFunction(widget[handler])) {
          $element = $root.find(
            "[data-sw-action='" + keyParts[1].trim() + "']"
          );
          $element
            .off(keyParts[0].trim())
            .on(keyParts[0].trim(), widget[handler].bind(widget));
        }
      });
    },
    undelegateEvents: function (widget) {
      var $root, events, keyParts, $element;
      if (!widget.events) return;
      $root = widget.$el;
      events = widget.events;
      _.each(events, function (handler, key) {
        keyParts = key.trim().split(" ");
        if (keyParts.length == 2) {
          $element = $root.find("[data-sw-action='" + keyParts[1] + "']");
          $element.off(keyParts[0]);
        }
      });
    },
  };
})(this);
(function (root) {
  var sw,
    security,
    randomString,
    generateNonce,
    generateTimestamp,
    encode,
    consumerKey,
    consumerSecret;
  sw = root.shortcuts.widgets;
  security = sw.security = {};
  security.OAuth = security.OAuth || {};

  randomString = function (length, chars) {
    var result = "";
    for (var i = length; i > 0; --i)
      result += chars[Math.round(Math.random() * (chars.length - 1))];
    return result;
  };

  generateNonce = function () {
    return randomString(
      8,
      "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
    );
  };

  generateTimestamp = function () {
    return Math.floor(new Date().getTime() / 1000);
  };

  /* Function to encode elements */
  encode = function (value) {
    if (value == null) {
      return "";
    }
    if (value instanceof Array) {
      var e = "";
      for (var i = 0; i < value.length; ++value) {
        if (e != "") e += "&";
        e += encode(value[i]);
      }
      return e;
    }
    value = encodeURIComponent(value);
    value = value.replace(/\!/g, "%21");
    value = value.replace(/\*/g, "%2A");
    value = value.replace(/\'/g, "%27");
    value = value.replace(/\(/g, "%28");
    value = value.replace(/\)/g, "%29");
    return value;
  };

  security.OAuth.defaultEncoding = {
    nonceCallback: generateNonce,
    timestampCallback: generateTimestamp,
  };

  security.OAuth.sign = function (jqXHR, ajaxOptions, accessCredential) {
    consumerKey = sw.getAppSetting("consumerKey");
    consumerSecret = sw.getAppSetting("consumerSecret");
    // Parse the URL into parts
    // Note that we are currently assuming that the url is already in canonical format, i.e. standardized scheme, port and domain.
    var encoding = security.OAuth.defaultEncoding;
    var method = ajaxOptions.type.toUpperCase();
    var urlParts = ajaxOptions.url.split("?");
    var url = urlParts[0];
    var query = urlParts[1];
    var queryParams = [];
    if (query) {
      queryParams = sw.vendor._.map(query.split("&"), function (param) {
        var paramParts = param.split("=");
        return {
          key: encode(decodeURIComponent(paramParts[0])),
          value: encode(decodeURIComponent(paramParts[1])),
        };
      });
    }

    // Generate anti-replay values
    var nonce = encoding.nonceCallback();
    var timestamp = encoding.timestampCallback();

    // Generate the oauth parameters
    var oauthParams = [
      { key: "oauth_consumer_key", value: encode(consumerKey) },
      { key: "oauth_nonce", value: nonce },
      { key: "oauth_signature_method", value: "HMAC-SHA1" },
      { key: "oauth_timestamp", value: timestamp },
      { key: "oauth_token", value: encode(accessCredential.accessToken) },
      { key: "oauth_version", value: "1.0" },
    ];

    // Combine in the query paramaters and sort them.
    var sortedParams = sw.vendor._.union(queryParams, oauthParams).sort(
      function (left, right) {
        if (left.key < right.key) {
          return -1;
        } else if (left.key > right.key) {
          return 1;
        } else if (left.value < right.value) {
          return -1;
        } else if (left.value > right.value) {
          return 1;
        } else {
          return 0;
        }
      }
    );

    // Format the parameters back into a single string.
    var formattedParams = sw.vendor._.map(sortedParams, function (param) {
      return param.key + "=" + param.value;
    }).join("&");

    // Calculate the OAuth Signature
    var base = method + "&" + encode(url) + "&" + encode(formattedParams);
    var key =
      encode(consumerSecret) + "&" + encode(accessCredential.accessTokenSecret);
    var signature = sw.vendor.CryptoJS.HmacSHA1(base, key).toString(
      sw.vendor.CryptoJS.enc.Base64
    );

    // Compile the OAuth Header
    var authHeader =
      'OAuth realm="' +
      url +
      '", ' +
      'oauth_consumer_key="' +
      encode(consumerKey) +
      '", ' +
      'oauth_token="' +
      encode(accessCredential.accessToken) +
      '", ' +
      'oauth_nonce="' +
      nonce +
      '", ' +
      'oauth_timestamp="' +
      timestamp +
      '", ' +
      'oauth_signature_method="' +
      "HMAC-SHA1" +
      '", ' +
      'oauth_version="' +
      "1.0" +
      '", ' +
      'oauth_signature="' +
      encode(signature) +
      '"';

    // Add the OAuth Header to the request.
    jqXHR.setRequestHeader("Authorization", authHeader);
  };
})(this);
(function (root) {
  var sw = root.shortcuts.widgets;
  var preloadCache = {};

  var mapToString = function (map) {
    var result = [];
    for (var key in map) {
      if (key !== "fields" && map.hasOwnProperty(key)) {
        result.push(key + "=" + map[key]);
      }
    }
    return result.sort().join("&");
  };

  var urlToKey = function (url, dataOptions) {
    return url + "?" + mapToString(dataOptions);
  };

  var doFetch = function (fetchFn, url, credentials, dataOptions, config) {
    // The actual AJAX call. It'll be either sw.ajaxSigned (which fails silently)
    // or to widgetRequest (which will display error popups)
    return fetchFn(
      url,
      credentials,
      {
        data: dataOptions,
        type: "GET",
        contentType: "application/json",
      },
      config
    );
  };

  sw.preloading = {
    /**
     * Adds an endpoint to the cache.
     * @param url The API location to call
     * @param dataOptions Data fields used as part of the call
     * @param credentials (optional) Credentials to use for signing
     * @param fetchFn (optional) Function to call for making the AJAX call
     * @returns A promise
     */
    add: function (url, dataOptions, credentials, fetchFn, config) {
      var widgetCredential, firstWidgetKey, firstWidgetCredential, key;

      fetchFn = fetchFn || sw.ajaxSigned;
      key = urlToKey(url, dataOptions);
      if (!credentials) {
        widgetCredential = sw.getAppSetting("widgetCredential");
        firstWidgetKey = sw.vendor._.keys(widgetCredential)[0];
        firstWidgetCredential = widgetCredential[firstWidgetKey];
        credentials = {
          accessToken: firstWidgetCredential.accessToken,
          accessTokenSecret: firstWidgetCredential.accessTokenSecret,
        };
      }

      return (preloadCache[key] = doFetch(
        fetchFn,
        url,
        credentials,
        dataOptions,
        config
      ));
    },

    /**
     * Reads any saved data for a given endpoint and options from the cache.
     * Will make the AJAX call for you if data is not in the cache.
     * @param url The API location to call
     * @param dataOptions Data fields used as part of the call
     * @param credentials (optional) Credentials to use for signing
     * @param fetchFn (optional function) Function to call for making the AJAX call
     * @param config {optional object} Configure client-side behaviour of this request.
     * @returns A promise
     */
    read: function (url, dataOptions, credentials, fetchFn, config) {
      var deferred, key;

      deferred = $.Deferred();
      key = urlToKey(url, dataOptions);

      // Not in cache
      if (!(key in preloadCache)) {
        return doFetch(fetchFn, url, credentials, dataOptions, config);
      }

      // Cache contains promises, so return the promise associated with this network call.
      // If we have a rejected promise saved, download it again and try to save it into the cache.
      preloadCache[key].done(deferred.resolve).fail(function () {
        sw.preloading
          .add(url, dataOptions, credentials, fetchFn, config)
          .then(deferred.resolve, deferred.reject);
      });

      return deferred.promise();
    },

    /**
     * Clears the cache.
     */
    clear: function () {
      preloadCache = {};
    },

    /**
     * Makes the calls to add() for commonly used endpoints.
     * Change this function to add/remove any endpoints to cache.
     * @param siteId A site ID
     */
    doDefaultPreloading: function (siteId) {
      var startDate, endDate, site, cacheEmployees;

      // Don't cache employees if we read the clocked on status, as
      // the clocked on status can change
      site = sw.cache.stateCache.get(siteId, "site");
      cacheEmployees =
        !site.is_online_queue_enabled ||
        !site.online_booking.use_current_employee_availability;

      if (cacheEmployees) {
        // Employees
        sw.handlers.getApiUrl
          .call({ siteId: siteId }, "site", "employees")
          .then(function (url) {
            sw.preloading.add(url, {
              is_active: true,
              fields:
                "display,biography_text,is_customer_bookable,is_available_for_walkin",
              limit: Number.MAX_VALUE,
            });
          });
      }

      // Services
      sw.handlers.getApiUrl
        .call({ siteId: siteId }, "site", "services")
        .then(function (url) {
          sw.preloading.add(url, {
            limit: 5000,
            is_active: true,
            is_customer_bookable: true,
            fields:
              "display,description,price,links,default_duration_minutes,break_duration_minutes",
          });
        });

      // MLS images and logos for the About Us screen
      sw.handlers.getApiUrl
        .call({ siteId: siteId }, "site", "image_gallery")
        .then(function (url) {
          sw.preloading.add(url, {});
        });
      sw.handlers.getApiUrl
        .call({ siteId: siteId }, "site", "manufacturer_images")
        .then(function (url) {
          sw.preloading.add(url, {});
        });
      sw.handlers.getApiUrl
        .call({ siteId: siteId }, "site", "industry_categories")
        .then(function (url) {
          sw.preloading.add(url, {});
        });

      // Specials
      sw.handlers.getApiUrl
        .call({ siteId: siteId }, "site", "specials/site_directory")
        .then(function (url) {
          sw.preloading.add(url, {});
        });

      if (site.is_online_queue_enabled) {
        // Calendar items
        startDate = sw.getSiteDateTime(siteId).format("YYYY-MM-DD");
        endDate = startDate;
        sw.handlers.getApiUrl
          .call({ siteId: siteId }, "site", "calendar")
          .then(function (url) {
            sw.preloading.add(url, {
              is_active: true,
              start_date: startDate,
              end_date: endDate,
              fields: "all",
              sort_by: "date",
            });
          });

        // Rosters
        sw.handlers.getApiUrl
          .call({ siteId: siteId }, "site", "rosters")
          .then(function (url) {
            sw.preloading.add(url, {
              is_active: true,
              rostered_from_date_time: startDate,
              rostered_to_date_time: endDate,
              fields: "all",
              sort_by: "date",
            });
          });

        sw.handlers.getApiUrl
          .call({ siteId: siteId }, "site", "opening_hours")
          .then(function (url) {
            sw.preloading.add(url + "/" + startDate, {
              is_roster_respected: false,
            });
          });
      }
    },
  };
})(this);
(function (root) {
  var sw, cachedImageRequests, imgBuffer, MAX_WIDTH, MAX_HEIGHT, MAX_SIZE;
  sw = root.shortcuts.widgets;

  // Cached image requests so that we don't repeat image requests within short time frames.
  cachedImageRequests = {};
  imgBuffer = document.createElement("img");

  // Limits to stop us uploading high-res photos where we can.
  MAX_WIDTH = 400;
  MAX_HEIGHT = 400;
  MAX_SIZE = 200000;

  /**
   * Creates a cached image request that will persist as a deferred request for one second after the server responds.
   * @param {string} apiPath The path to the image.
   * @param {object} credentials The OAuth token & secret.
   * @returns {$.Deferred} The asynchronous result.
   */
  function createRequest(apiPath, credentials) {
    if (typeof apiPath === "undefined" || apiPath === null || apiPath === "") {
      return $.Deferred().reject("Invalid Path");
    }

    if (!cachedImageRequests[apiPath]) {
      var deferred = $.Deferred();
      var xhr = new XMLHttpRequest();
      var xhrOptions = { type: "GET", url: apiPath };

      xhr.open(xhrOptions.type, xhrOptions.url, true);
      xhr.responseType = "arraybuffer";

      sw.security.OAuth.sign(xhr, xhrOptions, credentials);

      xhr.onreadystatechange = function () {
        if (xhr.readyState == 4) {
          if (xhr.status == 200) {
            deferred.resolve(
              xhr.response,
              xhr.getResponseHeader("Content-Type")
            );
          } else {
            deferred.reject("Request Failed");
          }
        }
      };
      xhr.send();

      // Remove the cached request one second after it completes, successfully or otherwise.
      // This ensures that a request made once three seconds has passed from the response of the
      // previous request will be made afresh
      deferred.always(function () {
        setTimeout(function () {
          cachedImageRequests[apiPath] = null;
        }, 3000);
      });

      cachedImageRequests[apiPath] = deferred;
    }
    return cachedImageRequests[apiPath];
  }

  // Loads the image from the API and updates the src property of the image.
  function loadImageFromApi(image, attr, apiPath, fallbackPath, credentials) {
    var request = getImageData(apiPath, credentials);

    request.done(function (blobUrl) {
      $(image).one("load", function () {
        $(this).removeData();
      });
      $(image).attr(attr, blobUrl);
    });

    if (fallbackPath) {
      request.fail(function () {
        $(image).attr(attr, fallbackPath);
      });
    }

    return request;
  }

  /**
   * Get an image from the API and returns as a blobbed data url.
   * @param {string} apiPath The location of the image.
   * @param {object} credentials OAuth token and secret for the request.
   * @returns {$.Deferred} Promise containing the data url or null if request failed.
   */
  function getImageData(apiPath, credentials) {
    var request;
    request = createRequest(apiPath, credentials).then(
      function (imageData, imageType) {
        var i,
          bytes,
          blobUrl,
          binaryString = "";
        bytes = new Uint8Array(imageData);
        for (i = 0; i < bytes.byteLength; i++) {
          binaryString += String.fromCharCode(bytes[i]);
        }
        if (!imageType || imageType === "undefined") {
          imageType = "image/jpeg";
        }
        blobUrl = "data:" + imageType + ";base64," + window.btoa(binaryString);
        return blobUrl;
      },
      function () {
        return null;
      }
    );

    return request;
  }

  // Saves an image to the API
  function saveImageToApi(request, apiPath, imageData, credentials) {
    var xhr = new XMLHttpRequest();
    var xhrOptions = { type: "PUT", url: apiPath };
    xhr.open(xhrOptions.type, xhrOptions.url, true);
    xhr.setRequestHeader("Content-Type", imageData.type);
    sw.security.OAuth.sign(xhr, xhrOptions, {
      accessToken: credentials.accessToken,
      accessTokenSecret: credentials.accessTokenSecret,
    });
    xhr.onreadystatechange = function () {
      if (xhr.readyState == 4) {
        if (xhr.status == 200) {
          request.resolve(xhr.responseText);
        } else {
          request.reject(xhr.responseText);
        }
      }
    };
    xhr.send(imageData);
  }

  // We use the MegaPix library to both work around an iOS bug regarding
  // scaling large photos, and to provide a simple path from blob to data URL.
  function resizeAndSaveImageToApi(
    request,
    apiPath,
    imageData,
    credentials,
    orientation
  ) {
    var megaPixRender = new sw.vendor.MegaPixImage(imageData);

    megaPixRender.onrender = function () {
      var dataUrl = imgBuffer.src;

      var resizeData = {};
      var contentType = dataUrl.split(",")[0].split(";")[0].split(":")[1];
      var byteString = atob(dataUrl.split(",")[1]);
      resizeData.uintBuffer = new Uint8Array(byteString.length);
      for (var i = 0; i < byteString.length; i++) {
        resizeData.uintBuffer[i] = byteString.charCodeAt(i);
      }
      resizeData.data = new Blob([resizeData.uintBuffer], {
        type: contentType,
      });

      // Save the image to the API
      saveImageToApi(request, apiPath, resizeData.data, credentials);
      request.always(function () {
        delete resizeData.uintBuffer;
        delete resizeData.data;
      });
    };

    megaPixRender.render(imgBuffer, {
      orientation: orientation,
      maxWidth: MAX_WIDTH,
      maxHeight: MAX_HEIGHT,
    });
    return request;
  }

  sw.loadImageFromApi = loadImageFromApi;
  sw.getImageData = getImageData;
  sw.uploadImageToApi = function (
    apiPath,
    imageData,
    credentials,
    orientation
  ) {
    var request = $.Deferred();
    if ((orientation || imageData.size > MAX_SIZE) && window.Blob) {
      resizeAndSaveImageToApi(
        request,
        apiPath,
        imageData,
        credentials,
        orientation
      );
    } else {
      saveImageToApi(request, apiPath, imageData, credentials);
    }
    return request;
  };
})(this);
(function (root) {
  var PaymentBase = function (widget) {
    this.widget = widget;
  };

  var sw = root.shortcuts.widgets;

  PaymentBase.prototype.isUpfrontPaymentEnabled = function (siteId) {
    var site = sw.cache.stateCache.get(siteId, "site");
    return site.is_upfront_payment_active == null
      ? false
      : site.is_upfront_payment_active;
  };

  PaymentBase.prototype.isCancellationFeeEnabled = function (siteId) {
    var site = sw.cache.stateCache.get(siteId, "site");
    var isCancellationFeeEnabled =
      site.is_cancellation_fee_enabled == null
        ? false
        : site.is_cancellation_fee_enabled;
    return isCancellationFeeEnabled;
  };

  PaymentBase.prototype.isOnlinePaymentEnabled = function (siteId) {
    var site = sw.cache.stateCache.get(siteId, "site");
    var isOnlinePaymentEnabled =
      site.is_online_payment_enabled == null
        ? false
        : site.is_online_payment_enabled;
    return isOnlinePaymentEnabled;
  };

  PaymentBase.prototype.isProviderEnabled = function () {
    return new $.Deferred().resolve();
  };

  /**
   * Extract the error object from the jqXHR and convey it to the deferred.reject()
   * @param jqXHR
   * @param deferred
   */
  PaymentBase.prototype.extractError = function (jqXHR, deferred) {
    if (jqXHR.responseJSON)
      deferred.reject({
        actionCancelled: true,
        errorCode: jqXHR.responseJSON.errorCode,
        message: jqXHR.responseJSON.message,
      });
    else deferred.reject({ actionCancelled: true });
  };

  sw.registerModule({ PaymentBase: PaymentBase });

  sw.handlers._PaymentBase = PaymentBase;
})(this);
/**
 * Created by jonikang on 3/5/17.
 */

(function (root) {
  var SCStripe = function (widget) {
    this.publishableKey = null;
    this.currency = null;
    this.stripeObject = null;
    this.widget = widget;
  };

  var sw = root.shortcuts.widgets;
  var paymentBase = new sw.handlers._PaymentBase();
  var security = sw.security.OAuth;
  var jwt_decode = root.jwt_decode;

  var paymentGatewayUrl = sw.getAppSetting("paymentGatewayUrl");
  var authenticationUrl = sw.getAppSetting("authenticationUrl");
  var jwtToken = null;

  function handleSetupIntentResponse(
    handler,
    response,
    setupIntentRequestDto,
    deferred
  ) {
    var status = response.status;

    if (status === "requires_action") {
      getStripeObject(handler)
        .handleCardSetup(response.clientSecret)
        .then(
          function (res) {
            if (res.error) {
              deferred.reject({
                actionCancelled: true,
                errorCode: res.error.code,
                message: res.error.message,
              });
            } else if (res.setupIntent) {
              // successfully run the SetupIntent
              setupIntentRequestDto.setupIntentId = res.setupIntent.id;
              handler
                .setupIntent(handler.widget.siteId, setupIntentRequestDto)
                .then(
                  function (res) {
                    deferred.resolve(res);
                  },
                  function (jqXHR) {
                    handler.extractError(jqXHR, deferred);
                  }
                );
            }
          },
          function (jqXHR) {
            handler.extractError(jqXHR, deferred);
          }
        );
    } else if (status === "succeeded") {
      deferred.resolve(response);
    } else if (status == null) {
      // no status means the payment is ok
      deferred.resolve(response);
    } else {
      deferred.reject({ actionCancelled: true, errMessage: status });
    }
  }

  function getStripeObject(handler) {
    if (!handler.stripeObject) {
      if (handler.publishableKey == null) {
        throw new Error(
          "the publishable key cannot be null, set the publishable key before calling this method"
        );
      }
      handler.stripeObject = Stripe(handler.publishableKey);
    }

    return handler.stripeObject;
  }

  /**
   * Return JWT Token Deferred Object
   * @returns {Deferred}
   */
  function requestJWTToken() {
    var accessCredentials = {
      accessToken: sw.getAppSetting("accessToken"),
      accessTokenSecret: sw.getAppSetting("accessTokenSecret"),
    };

    var deferred = $.Deferred();

    var cb = function () {
      $.ajax({
        url: sw.getAppSetting("authenticationUrl"),
        type: "POST",
        data: JSON.stringify({
          credential_type_code: "oauth",
        }),
        processData: false,
        contentType: "application/json; charset=utf-8",
        beforeSend: function (jqXHR, ajaxOptions) {
          security.sign(jqXHR, ajaxOptions, accessCredentials);
        },
      }).then(
        function (data) {
          jwtToken = data.access_token;
          deferred.resolve(jwtToken);
        },
        function () {
          deferred.reject();
        }
      );
    };

    if (jwtToken) {
      var jwtDecode = jwt_decode(jwtToken);
      var expiry = jwtDecode.exp;
      if (sw.vendor.moment(expiry * 1000).isAfter(sw.vendor.moment())) {
        setTimeout(function () {
          deferred.resolve(jwtToken);
        }, 100);
      } else {
        cb();
      }
    } else {
      cb();
    }

    return deferred.promise();
  }

  SCStripe.prototype.getProviderCode = function () {
    return "Stripe";
  };

  SCStripe.prototype.isUpfrontPaymentEnabled = function (siteId) {
    return paymentBase.isUpfrontPaymentEnabled(siteId);
  };

  SCStripe.prototype.isCancellationFeeEnabled = function (siteId) {
    return paymentBase.isCancellationFeeEnabled(siteId);
  };

  SCStripe.prototype.isOnlinePaymentEnabled = function (siteId) {
    return paymentBase.isOnlinePaymentEnabled(siteId);
  };

  SCStripe.prototype.isPaymentGatewayAvailable = function () {
    return !!sw.getAppSetting("paymentGatewayUrl");
  };

  SCStripe.prototype.isProviderSupported = function () {
    paymentGatewayUrl = sw.getAppSetting("paymentGatewayUrl");
    authenticationUrl = sw.getAppSetting("authenticationUrl");
    return !!window.Stripe && !!paymentGatewayUrl && !!authenticationUrl;
  };

  SCStripe.prototype.isProviderEnabled = function (siteId, reqParam) {
    var _this = this;
    if (!paymentGatewayUrl) return $.Deferred().reject();

    return requestJWTToken()
      .pipe(function (jwtToken) {
        return $.ajax({
          url: paymentGatewayUrl + "/site/" + siteId + "/setting",
          type: "GET",
          data: reqParam,
          headers: { Authorization: "JWT " + jwtToken },
        });
      })
      .pipe(function (response) {
        _this.publishableKey = response.stripePublishableKey;
        return new $.Deferred().resolve(response);
      });
  };

  SCStripe.prototype.removeCard = function (
    stripeCustomerId,
    cardSourceId,
    siteId
  ) {
    return requestJWTToken().pipe(function (jwtToken) {
      return $.ajax({
        url:
          paymentGatewayUrl +
          "/site/" +
          siteId +
          "/customer/card?" +
          $.param({
            stripeCustomerId: stripeCustomerId,
            cardSource: cardSourceId,
          }),
        type: "DELETE",
        headers: { Authorization: "JWT " + jwtToken },
        dataFilter: function () {
          return null;
        },
      });
    });
  };

  SCStripe.prototype.getCustomer = function (
    siteId,
    olsCustomerId,
    olsCustomerEmail
  ) {
    return requestJWTToken().pipe(function (jwtToken) {
      return $.ajax({
        url: paymentGatewayUrl + "/site/" + siteId + "/customer",
        type: "GET",
        data: {
          olsCustomerId: olsCustomerId,
          olsCustomerEmail: olsCustomerEmail,
        },
        headers: { Authorization: "JWT " + jwtToken },
      });
    });
  };

  SCStripe.prototype.refund = function (paymentIntentId, siteId) {
    return requestJWTToken().pipe(function (jwtToken) {
      return $.ajax({
        url: paymentGatewayUrl + "/site/" + siteId + "/cancelPaymentIntent",
        type: "GET",
        data: {
          paymentIntentId: paymentIntentId,
        },
        headers: { Authorization: "JWT " + jwtToken },
      });
    });
  };

  SCStripe.prototype.paymentIntent = function (data) {
    return requestJWTToken().pipe(function (jwtToken) {
      return $.ajax({
        url: paymentGatewayUrl + "/site/" + data.siteId + "/payment",
        type: "POST",
        processData: false,
        data: JSON.stringify(data),
        dataType: "json",
        contentType: "application/json; charset=utf-8",
        headers: { Authorization: "JWT " + jwtToken },
      });
    });
  };

  SCStripe.prototype.setupIntent = function (siteId, requestDto) {
    return requestJWTToken().pipe(function (jwtToken) {
      return $.ajax({
        url: paymentGatewayUrl + "/site/" + siteId + "/setupIntent",
        type: "POST",
        data: JSON.stringify(requestDto),
        contentType: "application/json; charset=utf-8",
        headers: { Authorization: "JWT " + jwtToken },
      });
    });
  };

  SCStripe.prototype.createPaymentMethod = function () {
    return getStripeObject(this).createPaymentMethod("card", this.card);
  };

  SCStripe.prototype.createPaymentIntent = function (deferred) {
    var _this = this;
    return getStripeObject(this)
      .createPaymentMethod("card", this.card)
      .then(function (result) {
        if (result.error) {
          // Inform the customer that there was an error.
          // var errorElement = document.getElementById('card-errors');
          // errorElement.textContent = result.error.message;
          deferred.reject({
            actionCancelled: true,
            errMessage: result.error.message,
          });
        } else {
          var paymentMethodId = result.paymentMethod.id;
          var customer = _this.widget.getState("customer");
          var setupIntentRequestDto = {
            olsCustomerId: customer.olsCustomerId,
            olsCustomerEmail: customer.olsCustomerEmail,
            paymentMethodId: paymentMethodId,
            setupIntentId: null,
          };
          _this.setupIntent(_this.widget.siteId, setupIntentRequestDto).then(
            function (r) {
              handleSetupIntentResponse(
                _this,
                r,
                setupIntentRequestDto,
                deferred
              );
            },
            function (jqXHR) {
              _this.extractError(jqXHR, deferred);
            }
          );
        }

        return new $.Deferred().resolve(result);
      });
  };

  SCStripe.prototype.handleCardAction = function (clientSecret) {
    // Stripe handles actions differently depending on whether we are setting up a card, or making a payment.
    var stripeLib = getStripeObject(this);
    if (clientSecret.startsWith("seti")) {
      return stripeLib.handleCardSetup(clientSecret);
    } else {
      return stripeLib.handleCardAction(clientSecret);
    }
  };

  /**
   * Extract the error object from the jqXHR and convey it to the deferred.reject()
   * @param jqXHR
   * @param deferred
   */
  SCStripe.prototype.extractError = function (jqXHR, deferred) {
    return paymentBase.extractError(jqXHR, deferred);
  };

  SCStripe.prototype.createAndMountCardElement = function (elementId) {
    var style = {
      base: {
        // Add your base input styles here. For example:
        fontSize: "16px",
        color: "#32325d",
        padding: "0.9em",
      },
    };

    this.card = getStripeObject(this)
      .elements()
      .create("card", { style: style, hidePostalCode: true });
    this.card.mount("#" + elementId);
    return this.card;
  };

  sw.registerModule({
    SCStripe: SCStripe,
  });

  sw.handlers._SCStripe = SCStripe;
})(this);

(function (root) {
  var sw = root.shortcuts.widgets;
  var paymentBase = new sw.handlers._PaymentBase();

  const CLIENT_SCRIPT_ID = "OpenEdgeClientScript";

  var SCOpenEdge = function (widget) {
    this.publishableKey = sw.getAppSetting("paymentProviderKey");
    this.card = {};
    this.widget = widget;
  };

  /**
   * Show a spinning loading animation.
   * @param {HTMLElement} spinner Container to show spinner
   */
  function startSpinner(spinner) {
    spinner.classList.add("ld");
    spinner.classList.add("ld-ring");
    spinner.classList.add("ld-spin");
  }

  /**
   * Hide a current loading animation.
   * @param {HTMLElement} spinner Container to show spinner
   */
  function stopSpinner(spinner) {
    spinner.classList.remove("ld");
    spinner.classList.remove("ld-ring");
    spinner.classList.remove("ld-spin");
  }

  /**
   * Call payfields to inject card details iframes.
   * @param {string} containerId All relevant elements will be inside this container.
   * @param {function} onSuccess Called when payfields detects a valid card.
   * @param {function} onError Called when payfields detects an invalid card.
   * @param {string} submitText Text that will appear on the submit button.
   */
  function initialisePayfields(containerId, onSuccess, onError, submitText) {
    var _this,
      i,
      container,
      form,
      elements,
      iframeCount,
      onIframeLoad,
      spinner,
      referenceButton,
      buttonStyleReference,
      inputStyleReference;

    const elementIds = {
      number: "#" + containerId + " #sw-card-number",
      expiry: "#" + containerId + " #sw-card-expiry",
      cvv: "#" + containerId + " #sw-card-cvv",
      submit: "#sw-card-submit",
    };

    _this = this;

    /**
     * When all iframes have finished loading, we can display them all at once.
     * @param event
     */
    onIframeLoad = function (event) {
      iframeCount++;
      if (iframeCount >= elements.length) {
        for (i = 0; i < elements.length; i++) {
          elements[i].style.height = "";
        }
        container.style.height = "";
        stopSpinner(spinner);
      }

      event.target.removeEventListener("load", onIframeLoad);
    };

    GlobalPayments.configure({
      "X-GP-Api-Key": this.publishableKey,
      "X-GP-Environment": sw.getAppSetting("paymentProviderEnvironment"),
    });

    referenceButton = document.createElement("button");
    container = document.getElementById(containerId);
    container.appendChild(referenceButton);

    buttonStyleReference = window.getComputedStyle(referenceButton);
    inputStyleReference = window.getComputedStyle(
      document.querySelector(
        "#" + containerId + " input[type='text']:not(:focus)"
      )
    );

    // Hide the open-edge controls while they are loading, and throw up a spinning indicator, so they don't pop-in one by one, which is pretty ugly.
    container = container.querySelector("#sw-openedge-container");
    // For some reason, setting display:none won't work - the iframe don't render properly.  Setting height to 0 does the trick though.
    container.style.height = "0";
    container.style.overflowY = "hidden";
    spinner = container.parentNode.querySelector(".sw-loading-spinner");

    form = GlobalPayments.ui.form({
      fields: {
        "card-number": {
          target: elementIds.number,
          placeholder: sw.strings.numberPlaceholder,
        },
        "card-expiration": {
          target: elementIds.expiry,
          placeholder: sw.strings.expiryPlaceholder,
        },
        "card-cvv": {
          target: elementIds.cvv,
          placeholder: sw.strings.cvvPlaceholder,
        },
        submit: {
          target: elementIds.submit,
          "data-sw-action": "confirm",
          text: submitText,
        },
      },
      styles: {
        input: {
          "-ms-appearance": inputStyleReference.msAppearance,
          "-moz-appearance": inputStyleReference.mozApperance,
          "-webkit-appearance": inputStyleReference.webkitAppearance,
          appearance: inputStyleReference.appearance,
          padding: inputStyleReference.padding,
          "font-size": inputStyleReference.fontSize,
          "border-radius": inputStyleReference.borderRadius,
          "font-family": inputStyleReference.fontFamily,
          "text-align": inputStyleReference.textAlign,
          "margin-bottom": inputStyleReference.marginBottom,
          "margin-top": inputStyleReference.marginTop,
          width: inputStyleReference.width,
          "max-width": inputStyleReference.maxWidth,
          "margin-left": inputStyleReference.marginLeft,
          "margin-right": inputStyleReference.marginRight,
          "-webkit-box-sizing": inputStyleReference.webkitBoxSizing,
          "box-sizing": inputStyleReference.boxSizing,
          border: inputStyleReference.border,
          "background-clip": inputStyleReference.backgroundClip,
          "border-top": inputStyleReference.borderTop,
          "border-left": inputStyleReference.borderLeft,
          "border-right": inputStyleReference.borderRight,
          "border-bottom": inputStyleReference.borderBottom,
        },
        button: {
          "text-align": buttonStyleReference.textAlign,
          "background-color": buttonStyleReference.backgroundColor,
          font: buttonStyleReference.font,
          "font-size": buttonStyleReference.fontSize,
          padding: buttonStyleReference.padding,
          color: buttonStyleReference.color,
          "margin-top": buttonStyleReference.marginTop,
          overflow: buttonStyleReference.overflow,
          display: buttonStyleReference.display,
          width: buttonStyleReference.width,
          "max-width": buttonStyleReference.maxWidth,
          // Centre align the button.  Important required because payfields implements its own #secure-payment-field { margin: 0 } style.
          "margin-left": "auto !important",
          "margin-right": "auto !important",
          "-webkit-box-sizing": buttonStyleReference.webkitBoxSizing,
          "box-sizing": buttonStyleReference.boxSizing,
          "-moz-appearance": buttonStyleReference.mozAppearance,
          "-ms-appearance": buttonStyleReference.msAppearance,
          "-webkit-appearance": buttonStyleReference.webkitAppearance,
          appearance: buttonStyleReference.appearance,
          border: buttonStyleReference.border,
          "border-radius": buttonStyleReference.borderRadius,
          "vertical-align": buttonStyleReference.verticalAlign,
        },
      },
    });

    // We do need to hide the elements individually as well.
    elements = document.querySelectorAll(
      [
        elementIds.number,
        elementIds.expiry,
        elementIds.cvv,
        elementIds.submit,
      ].join(",")
    );
    for (i = 0; i < elements.length; i++) {
      elements[i].style.height = 0;
      elements[i].style.overflowY = "hidden";
      // When all elements have been loaded, we can show them.
      elements[i]
        .querySelector("iframe")
        .addEventListener("load", onIframeLoad);
    }
    iframeCount = 0;

    referenceButton.parentElement.removeChild(referenceButton);

    form.on("token-success", function (response) {
      _this.card.response = response;
      onSuccess(response.temporary_token);
    });

    form.on("token-error", function (response) {
      _this.card.error = response;
      onError(response.error.code);
    });
  }

  SCOpenEdge.prototype.getProviderCode = function () {
    return "GlobalPaymentsIntegrated";
  };

  SCOpenEdge.prototype.isUpfrontPaymentEnabled = function (siteId) {
    return paymentBase.isUpfrontPaymentEnabled(siteId);
  };

  SCOpenEdge.prototype.isCancellationFeeEnabled = function (siteId) {
    return paymentBase.isCancellationFeeEnabled(siteId);
  };

  SCOpenEdge.prototype.isOnlinePaymentEnabled = function (siteId) {
    return paymentBase.isOnlinePaymentEnabled(siteId);
  };

  SCOpenEdge.prototype.isPaymentGatewayAvailable = function () {
    return false;
  };

  /**
   * Ensure we have everything we need to use this provider.
   * @returns {boolean}
   */
  SCOpenEdge.prototype.isProviderSupported = function () {
    return (
      sw.getAppSetting("paymentProviderKey") &&
      sw.getAppSetting("paymentProviderEnvironment") &&
      sw.getAppSetting("providerUrl")
    );
  };

  /**
   * Returns basic config associated with the payment provider in a promise.
   * @returns {$.Deferred} promise that resolves with provider config.
   */
  SCOpenEdge.prototype.isProviderEnabled = function (siteId, reqParam) {
    var site, culture, currency;
    site = this.widget.getState("site");
    culture = site.regional_settings.culture_code.toLowerCase();

    switch (culture) {
      case "en-us":
        currency = "USD";
        break;
      case "en-ca":
        currency = "CAD";
        break;
      case "en-au":
        currency = "AUD";
        break;
      case "en-nz":
        currency = "NZD";
        break;
      case "en-uk":
        currency = "GBP";
        break;
      default:
        currency = "USD";
    }
    return $.Deferred().resolve({
      defaultCurrency: currency,
    });
  };

  SCOpenEdge.prototype.removeCard = function (
    stripeCustomerId,
    cardSourceId,
    siteId
  ) {
    return $.Deferred().reject();
  };

  SCOpenEdge.prototype.getCustomer = function (
    siteId,
    olsCustomerId,
    olsCustomerEmail
  ) {
    var customer = this.widget.getState("customer");
    return new $.Deferred().resolve([
      {
        last4Number: customer.credit_card_number,
      },
    ]);
  };

  /**
   * Refunds an existing payment via the payment provider.
   */
  SCOpenEdge.prototype.refund = function (data) {
    var _this = this;
    return this.widget
      .getApiUrl("site", "customer/refund_fee")
      .then(function (url) {
        _this.widget.signedPost(url, {
          refund_amount: data.amount,
          provider_payment_reference: data.providerPaymentReference,
          online_payment_number: data.providerClientReference,
        });
      });
  };

  SCOpenEdge.prototype.paymentIntent = function (data) {
    return $.Deferred().reject();
  };

  SCOpenEdge.prototype.setupIntent = function (siteId, requestDto) {
    return $.Deferred().reject();
  };

  SCOpenEdge.prototype.createPaymentMethod = function () {
    return $.Deferred().reject();
  };

  SCOpenEdge.prototype.createPaymentIntent = function (deferred) {
    return $.Deferred().reject();
  };

  SCOpenEdge.prototype.handleCardAction = function (clientSecret) {
    return $.Deferred().reject();
  };

  /**
   * Extract the error object from the jqXHR and convey it to the deferred.reject()
   * @param jqXHR
   * @param deferred
   */
  SCOpenEdge.prototype.extractError = function (jqXHR, deferred) {
    return paymentBase.extractError(jqXHR, deferred);
  };

  /**
   * Ensures payfields javascript has loaded, then calls it to inject card details iframes.
   * @param {string} elementId All relevant elements will be inside this container.
   * @param {function} onSuccess Called when payfields detects a valid card.
   * @param {function} onError Called when payfields detects an invalid card.
   * @param {string} submitText Text that will appear on the submit button.
   */
  SCOpenEdge.prototype.createAndMountCardElement = function (
    elementId,
    onSuccess,
    onError,
    submitText
  ) {
    var script, container;

    // Show a loading indicator as we load up the iframes.
    container = document.getElementById(elementId);
    startSpinner(container.querySelector(".sw-loading-spinner"));

    if (!document.getElementById(CLIENT_SCRIPT_ID)) {
      script = document.createElement("script");
      script.onload = initialisePayfields.bind(
        this,
        elementId,
        onSuccess,
        onError,
        submitText
      );
      script.src = sw.getAppSetting("providerUrl");
      script.id = CLIENT_SCRIPT_ID;
      document.head.appendChild(script);
    } else {
      initialisePayfields.call(this, elementId, onSuccess, onError, submitText);
    }
  };

  SCOpenEdge.prototype.getResponse = function () {
    return this.card && this.card.response;
  };

  sw.registerModule({
    SCOpenEdge: SCOpenEdge,
  });

  sw.handlers._SCOpenEdge = SCOpenEdge;
})(this);

(function (root) {
  var sw = root.shortcuts.widgets;
  var paymentBase = new sw.handlers._SCOpenEdge();
  var CLIENT_SCRIPT_ID,
    SUBMIT_ID,
    SUBMIT_BUTTON,
    EXPIRY_ID,
    EXPIRY_MONTH_ID,
    EXPIRY_YEAR_ID,
    LAST_NAME_ID,
    CUSTOMER_ID_ID;

  CLIENT_SCRIPT_ID = "EzidebitClientScript";
  SUBMIT_ID = "sw-card-submit";
  EXPIRY_ID = "sw-ezidebit-card-expiration";
  EXPIRY_MONTH_ID = "sw-ezidebit-card-expiration-month";
  EXPIRY_YEAR_ID = "sw-ezidebit-card-expiration-year";
  LAST_NAME_ID = "sw-ezidebit-customer-name";
  CUSTOMER_ID_ID = "sw-ezidebit-customer-id";

  /**
   * Constructor.
   * @param {widget} widget the provider is bound to.
   * @param {string} submitId id of the submit button to bind events to.
   * @constructor
   */
  var SCEzidebit = function (widget, submitId) {
    var _this = this;
    this.card = {};
    this.submitId = submitId || SUBMIT_ID;
    this.widget = widget;

    this.setupPromise = this.widget
      .getApiUrl("customer_session")
      .then(function (url) {
        return _this.widget.signedGet(
          url + "/site/" + _this.widget.siteId + "/configuration"
        );
      })
      .then(function (response) {
        _this.publishableKey = response.payment_provider_publishable_key;
        _this.card.billing_token = response.billing_token;
      })
      .fail(function () {
        console.error("Unable to retrieve Ezidebit publishable key.");
      });
  };

  /**
   * Update the expiry month and year fields whenever the expiration date field is updated.
   * @param {BlurEvent} event
   */
  function onCardExpirationUpdate(event) {
    var cardExpiration, expiryFields;
    cardExpiration = event.target;

    if (cardExpiration.value.length < 4 || cardExpiration.value.length > 7) {
      return;
    }

    expiryFields = cardExpiration.value.split("/");

    // Small convenience provisions.
    if (expiryFields[0].length === 1) {
      expiryFields[0] = "0" + expiryFields[0];
    }

    document.getElementById(EXPIRY_MONTH_ID).value = expiryFields[0];

    if (!expiryFields[1]) {
      return;
    }

    if (expiryFields[1].length === 2) {
      expiryFields[1] = "20" + expiryFields[1];
    }
    document.getElementById(EXPIRY_YEAR_ID).value = expiryFields[1];
  }

  /**
   *
   * @param {string} action The ezidebit action to call eg SaveCustomer
   */
  function initEzidebit(action, onSuccess, onError) {
    var _this = this;
    eziDebit.init(
      this.publishableKey,
      {
        // SaveCustomer creates the customer with the provided card details.
        // ChangeCustomerPaymentInfo updates an existing customer.
        submitAction: action,

        // Callbacks
        submitCallback: function (response) {
          if (response && response.Data && response.Data.CustomerRef) {
            _this.card.billing_token = response.Data.CustomerRef;
            _this.card.response = response;

            // Once we have the token, reboot ezidebit so it will use ChangeCustomerPaymentInfo next time.
            initEzidebit("ChangeCustomerPaymentInfo", onSuccess, onError);
          } else {
            // 'ChangeCustomerPaymentInfo' doesn't return a token, but we have it cached away for the other systems to use.
            _this.card.response = response;
            if (typeof _this.card.response.Data === "string") {
              _this.card.response.StringData = _this.card.response.Data;
            }
            _this.card.response.Data = {};
            _this.card.response.Data.CustomerRef = _this.card.billing_token;
          }
          onSuccess(_this.card.billing_token);
        },
        submitError: function (error) {
          _this.card.error = error;
          onError(error);
        },

        // Input/button element IDs
        submitButton: this.submitId,
        customerLastName: LAST_NAME_ID,
        nameOnCard: "sw-ezidebit-card-name",
        cardNumber: "sw-ezidebit-card-number",
        cardExpiryMonth: EXPIRY_MONTH_ID,
        cardExpiryYear: EXPIRY_YEAR_ID,
        customerReference: CUSTOMER_ID_ID,
      },
      sw.getAppSetting("providerUrl")
    );
  }

  function initialiseEzidebit(containerId, onSuccess, onError, submitText) {
    // Set label on submit button.
    var submitButton, customer, _this;

    _this = this;

    submitButton = document.getElementById(_this.submitId);
    submitButton.innerText = submitText;

    // Adjust expiry date as it is entered.
    document
      .getElementById(EXPIRY_ID)
      .addEventListener("blur", onCardExpirationUpdate);

    // Set customer last name as required by ezidebit.
    customer = this.widget.getState("customer");
    document.getElementById(CUSTOMER_ID_ID).value =
      customer.parameters.customer_number;
    document.getElementById(LAST_NAME_ID).value = customer.lastName;

    initEzidebit.call(
      _this,
      _this.card.billing_token ? "ChangeCustomerPaymentInfo" : "SaveCustomer",
      onSuccess,
      onError
    );
  }

  SCEzidebit.prototype.createAndMountCardElement = function (
    elementId,
    onSuccess,
    onError,
    submitText
  ) {
    var script;
    if (!document.getElementById(CLIENT_SCRIPT_ID)) {
      script = document.createElement("script");
      script.onload = initialiseEzidebit.bind(
        this,
        elementId,
        onSuccess,
        onError,
        submitText
      );
      script.src =
        "https://static.ezidebit.com.au/javascriptapi/js/ezidebit_2_0_0.min.js";
      script.id = CLIENT_SCRIPT_ID;
      document.head.appendChild(script);
    } else {
      initialiseEzidebit.call(this, elementId, onSuccess, onError, submitText);
    }
  };

  SCEzidebit.prototype.getProviderCode = function () {
    return "Ezidebit";
  };

  /**
   * Ensure we have everything we need to use this provider.
   * @returns {boolean}
   */
  SCEzidebit.prototype.isProviderSupported = function () {
    return (
      sw.getAppSetting("providerUrl") &&
      // We can't wait for this to resolve here, but we can at least reject if it has already beem rejected.
      // Call isProviderEnabled for a definitive answer.
      this.setupPromise &&
      this.setupPromise.state() !== "rejected"
    );
  };

  SCEzidebit.prototype.isUpfrontPaymentEnabled = function (siteId) {
    return paymentBase.isUpfrontPaymentEnabled.apply(this, arguments);
  };

  SCEzidebit.prototype.isCancellationFeeEnabled = function (siteId) {
    return paymentBase.isCancellationFeeEnabled.apply(this, arguments);
  };

  SCEzidebit.prototype.isOnlinePaymentEnabled = function (siteId) {
    return paymentBase.isOnlinePaymentEnabled.apply(this, arguments);
  };

  SCEzidebit.prototype.isPaymentGatewayAvailable = function () {
    return false;
  };

  SCEzidebit.prototype.isProviderEnabled = function (siteId, reqParam) {
    return this.setupPromise.then(
      function () {
        if (!this.publishableKey) {
          return new $.Deferred().reject();
        }

        return paymentBase.isProviderEnabled.apply(this, arguments);
      }.bind(this)
    );
  };

  SCEzidebit.prototype.removeCard = function (
    customerId,
    cardSourceId,
    siteId
  ) {
    return paymentBase.removeCard.apply(this, arguments);
  };

  SCEzidebit.prototype.getCustomer = function (
    siteId,
    olsCustomerId,
    olsCustomerEmail
  ) {
    return paymentBase.getCustomer.apply(this, arguments);
  };

  SCEzidebit.prototype.refund = function (data) {
    return paymentBase.refund.apply(this, arguments);
  };

  SCEzidebit.prototype.paymentIntent = function (data) {
    return paymentBase.paymentIntent.apply(this, arguments);
  };

  SCEzidebit.prototype.setupIntent = function (siteId, requestDto) {
    return paymentBase.setupIntent.apply(this, arguments);
  };

  SCEzidebit.prototype.createPaymentMethod = function () {
    return paymentBase.createPaymentMethod.apply(this, arguments);
  };

  SCEzidebit.prototype.createPaymentIntent = function (deferred) {
    return paymentBase.createPaymentIntent.apply(this, arguments);
  };

  SCEzidebit.prototype.handleCardAction = function (clientSecret) {
    return paymentBase.handleCardAction.apply(this, arguments);
  };

  SCEzidebit.prototype.extractError = function (jqXHR, deferred) {
    return paymentBase.extractError.apply(this, arguments);
  };

  SCEzidebit.prototype.getResponse = function () {
    return paymentBase.getResponse.apply(this, arguments);
  };

  sw.registerModule({
    SCEzidebit: SCEzidebit,
  });

  sw.handlers._SCEzidebit = SCEzidebit;
})(window);
/**
 * Created by jonikang on 3/5/17.
 * @deprecated This file stripe.js is now deprecated. Do not make further changes to this file. sc-stripe-handler.js superseded this file. - 28/08/2019
 */

(function (root) {
  var postponeFunc = function (root) {
    root.Stripe = root.Stripe || {};
    var STP = root.Stripe;
    var sw = root.shortcuts.widgets;
    var security = sw.security.OAuth;
    var jwt_decode = root.jwt_decode;

    var paymentGatewayUrl = sw.getAppSetting("paymentGatewayUrl");
    var authenticationUrl = sw.getAppSetting("authenticationUrl");
    var jwtToken = null;

    /**
     * Return JWT Token Deferred Object
     * @returns {Deferred}
     */
    function requestJWTToken() {
      var accessCredentials = {
        accessToken: sw.getAppSetting("accessToken"),
        accessTokenSecret: sw.getAppSetting("accessTokenSecret"),
      };

      var deferred = $.Deferred();

      const cb = function () {
        $.ajax({
          url: sw.getAppSetting("authenticationUrl"),
          type: "POST",
          data: JSON.stringify({
            credential_type_code: "oauth",
          }),
          processData: false,
          contentType: "application/json; charset=utf-8",
          beforeSend: function (jqXHR, ajaxOptions) {
            security.sign(jqXHR, ajaxOptions, accessCredentials);
          },
        }).then(
          function (data) {
            jwtToken = data.access_token;
            deferred.resolve(jwtToken);
          },
          function (err) {
            deferred.reject();
          }
        );
      };

      if (jwtToken) {
        const jwtDecode = jwt_decode(jwtToken);
        const expiry = jwtDecode.exp;
        if (sw.vendor.moment(expiry * 1000).isAfter(sw.vendor.moment())) {
          setTimeout(function () {
            deferred.resolve(jwtToken);
          }, 100);
        } else {
          cb();
        }
      } else {
        cb();
      }

      return deferred.promise();
    }

    STP.isUpfrontPaymentEnabled = function (siteId) {
      var site = sw.cache.stateCache.get(siteId, "site");
      var isUpfrontPaymentActive =
        site.is_upfront_payment_active == null
          ? false
          : site.is_upfront_payment_active;
      return isUpfrontPaymentActive;
    };

    STP.isCancellationFeeEnabled = function (siteId) {
      var site = sw.cache.stateCache.get(siteId, "site");
      var isCancellationFeeEnabled =
        site.is_cancellation_fee_enabled == null
          ? false
          : site.is_cancellation_fee_enabled;
      return isCancellationFeeEnabled;
    };

    STP.isOnlinePaymentEnabled = function (siteId) {
      var site = sw.cache.stateCache.get(siteId, "site");
      var isOnlinePaymentEnabled =
        site.is_online_payment_enabled == null
          ? false
          : site.is_online_payment_enabled;
      return isOnlinePaymentEnabled;
    };

    STP.isPaymentGatewayAvailable = function () {
      return !!sw.getAppSetting("paymentGatewayUrl");
    };

    STP.isProviderSupported = function () {
      paymentGatewayUrl = sw.getAppSetting("paymentGatewayUrl");
      authenticationUrl = sw.getAppSetting("authenticationUrl");
      if (!!window.Stripe && !!paymentGatewayUrl && !!authenticationUrl)
        return true;

      return false;
    };

    STP.isProviderEnabled = function (siteId, reqParam) {
      if (!paymentGatewayUrl) return $.Deferred().reject();

      return requestJWTToken().pipe(function (jwtToken) {
        return $.ajax({
          url: paymentGatewayUrl + "/site/" + siteId + "/setting",
          type: "GET",
          data: reqParam,
          headers: { Authorization: "JWT " + jwtToken },
        });
      });
    };

    STP.removeCard = function (stripeCustomerId, cardSourceId, siteId) {
      return requestJWTToken().pipe(function (jwtToken) {
        return $.ajax({
          url:
            paymentGatewayUrl +
            "/site/" +
            siteId +
            "/customer/card?" +
            $.param({
              stripeCustomerId: stripeCustomerId,
              cardSource: cardSourceId,
            }),
          type: "DELETE",
          headers: { Authorization: "JWT " + jwtToken },
          dataFilter: function (data, type) {
            return null;
          },
        });
      });
    };

    STP.getCustomer = function (siteId, olsCustomerId, olsCustomerEmail) {
      return requestJWTToken().pipe(function (jwtToken) {
        return $.ajax({
          url: paymentGatewayUrl + "/site/" + siteId + "/customer",
          type: "GET",
          data: {
            olsCustomerId: olsCustomerId,
            olsCustomerEmail: olsCustomerEmail,
          },
          headers: { Authorization: "JWT " + jwtToken },
        });
      });
    };

    STP.refund = function (chargeReference, siteId) {
      return requestJWTToken().pipe(function (jwtToken) {
        return $.ajax({
          url: paymentGatewayUrl + "/site/" + siteId + "/refundPaymentAmount",
          type: "GET",
          data: {
            reference: chargeReference,
          },
          headers: { Authorization: "JWT " + jwtToken },
        });
      });
    };

    STP.charge = function (data) {
      return requestJWTToken().pipe(function (jwtToken) {
        return $.ajax({
          url: paymentGatewayUrl + "/site/" + data.siteId + "/charge?",
          type: "POST",
          processData: false,
          data: JSON.stringify(data),
          dataType: "json",
          contentType: "application/json; charset=utf-8",
          headers: { Authorization: "JWT " + jwtToken },
        });
      });
    };
  };

  // detect Stripe.js - SCA Compatible version
  /*
    The reason for this is to load the newer version of the Stripe.js without making changes in the index.html. However there is a risk of race condiction where if some part of the scripts expecting the window.Stripe to be setup properly
    if the 'load' event has not finished. Esp the isStripeSupported and isPaymentGatewayAvailable functions.
     */
  if (
    typeof root.Stripe == "undefined" ||
    typeof root.Stripe.handleCardSetup == "undefined"
  ) {
    var head = document.getElementsByTagName("head")[0];
    var script = document.createElement("script");
    script.type = "text/javascript";
    script.src = "https://js.stripe.com/v3/";
    script.async = false;
    script.addEventListener("load", function () {
      postponeFunc.call(root, root);
    });
    head.appendChild(script);
  } else {
    postponeFunc.call(this, root);
  }
})(this);
