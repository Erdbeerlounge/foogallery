(function (FOOGALLERY, $, undefined) {

    FOOGALLERY.media_uploader = false;
    FOOGALLERY.previous_post_id = 0;
    FOOGALLERY.attachments = [];
    FOOGALLERY.selected_attachment_id = 0;

    FOOGALLERY.calculateAttachmentIds = function() {
        var sorted = [];
        $('.foogallery-attachments-list li:not(.add-attachment)').each(function() {
            sorted.push( $(this).data('attachment-id') );
        });

        $('#foogallery_attachments').val( sorted.join(',') );
    };

    FOOGALLERY.initAttachments = function() {
        var attachments = $('#foogallery_attachments').val();
		if (attachments) {
			FOOGALLERY.attachments = $.map(attachments.split(','), function (value) {
				return parseInt(value, 10);
			});
		}
    };

	FOOGALLERY.settingsChanged = function() {
		var selectedTemplate = $('#FooGallerySettings_GalleryTemplate').val();

		//hide all template fields
		$('.foogallery-metabox-settings .gallery_template_field').not('.gallery_template_field_selector').hide();

		//show all fields for the selected template only
		$('.foogallery-metabox-settings .gallery_template_field-' + selectedTemplate).show();

		//include a preview CSS if possible
		FOOGALLERY.includePreviewCss();

		//trigger a change so custom template js can do something
		FOOGALLERY.triggerTemplateChangedEvent();
	};

	FOOGALLERY.initSettings = function() {
		$('#FooGallerySettings_GalleryTemplate').change(FOOGALLERY.settingsChanged);

		//include our selected preview CSS
		FOOGALLERY.includePreviewCss();

		//trigger this onload too!
		FOOGALLERY.triggerTemplateChangedEvent();
		FOOGALLERY.settingsChanged();
	};

	FOOGALLERY.includePreviewCss = function() {
		var selectedPreviewCss = $('#FooGallerySettings_GalleryTemplate').find(":selected").data('preview-css');

		if ( selectedPreviewCss ) {
			$('#foogallery-preview-css').remove();
			$('head').append('<link id="foogallery-preview-css" rel="stylesheet" href="' + selectedPreviewCss +'" type="text/css" />');
		}
	};

	FOOGALLERY.triggerTemplateChangedEvent = function() {
		var selectedTemplate = $('#FooGallerySettings_GalleryTemplate').val();
		$('body').trigger('foogallery-gallery-template-changed-' + selectedTemplate );
	};

    FOOGALLERY.addAttachmentToGalleryList = function(attachment) {

        if ($.inArray(attachment.id, FOOGALLERY.attachments) !== -1) return;

        var $template = $($('#foogallery-attachment-template').val());

        $template.attr('data-attachment-id', attachment.id);

        $template.find('img').attr('src', attachment.src);

        $('.foogallery-attachments-list .add-attachment').before($template);

        FOOGALLERY.attachments.push( attachment.id );

        FOOGALLERY.calculateAttachmentIds();
    };

    FOOGALLERY.removeAttachmentFromGalleryList = function(id) {
        var index = $.inArray(id, FOOGALLERY.attachments);
        if (index !== -1) {
            FOOGALLERY.attachments.splice(index, 1);
        }
		$('[data-attachment-id="' + id + '"]').remove();

        FOOGALLERY.calculateAttachmentIds();
    };

	FOOGALLERY.showAttachmentInfoModal = function(id) {
		FOOGALLERY.openMediaModal( id );
	};

	FOOGALLERY.openMediaModal = function(selected_attachment_id) {
		if (!selected_attachment_id) { selected_attachment_id = 0; }
		FOOGALLERY.selected_attachment_id = selected_attachment_id;

		//if the media frame already exists, reopen it.
		if ( FOOGALLERY.media_uploader !== false ) {
			// Open frame
			FOOGALLERY.media_uploader.open();
			return;
		}

        wp.media.controller.Library = wp.media.controller.Library.extend({
            defaults: {
                id: 'library',
                title: l10n.mediaLibraryTitle,
                multiple: false,
                content: 'browse',
                menu: 'default',
                router: 'browse',
                toolbar: 'select',
                searchable: true,
                filterable: false,
                sortable: true,
                autoSelect: true,
                describe: false,
                contentUserSetting: false,
                syncSelection: true,
                priority: 120,
                type: 'link',
                url: '',
                metadata: {}
            },
            // The amount of time used when debouncing the scan.
            sensitivity: 400,

            /**
             * If a library isn't provided, query all media items.
             * If a selection instance isn't provided, create one.
             *
             * @since 3.5.0
             */
            initialize: function (options) {
                var selection = this.get('selection'),
                    props;

                if (!this.get('library')) {
                    this.set('library', wp.media.query());
                }

                if (!( selection instanceof wp.media.model.Selection )) {
                    props = selection;

                    if (!props) {
                        props = this.get('library').props.toJSON();
                        props = _.omit(props, 'orderby', 'query');
                    }

                    this.set('selection', new wp.media.model.Selection(null, {
                        multiple: this.get('multiple'),
                        props: props
                    }));
                }

                this.resetDisplays();

                this.metadata = options.metadata;
                this.debouncedScan = _.debounce(_.bind(this.scan, this), this.sensitivity);
                this.props = new Backbone.Model(this.metadata || {url: ''});
                this.props.on('change:url', this.debouncedScan, this);
                this.props.on('change:url', this.refresh, this);
                this.on('scan', this.scanImage, this);
            },

            /**
             * Trigger a scan of the embedded URL's content for metadata required to embed.
             *
             * @fires wp.media.controller.Embed#scan
             */
            scan: function () {
                var scanners,
                    embed = this,
                    attributes = {
                        type: 'link',
                        scanners: []
                    };

                // Scan is triggered with the list of `attributes` to set on the
                // state, useful for the 'type' attribute and 'scanners' attribute,
                // an array of promise objects for asynchronous scan operations.
                if (this.props.get('url')) {
                    this.trigger('scan', attributes);
                }

                if (attributes.scanners.length) {
                    scanners = attributes.scanners = $.when.apply($, attributes.scanners);
                    scanners.always(function () {
                        if (embed.get('scanners') === scanners) {
                            embed.set('loading', false);
                        }
                    });
                } else {
                    attributes.scanners = null;
                }

                attributes.loading = !!attributes.scanners;
                this.set(attributes);
            },
            /**
             * Try scanning the embed as an image to discover its dimensions.
             *
             * @param {Object} attributes
             */
            scanImage: function( attributes ) {
                var frame = this.frame,
                    state = this,
                    url = this.props.get('url'),
                    image = new Image(),
                    deferred = $.Deferred();

                attributes.scanners.push( deferred.promise() );

                // Try to load the image and find its width/height.
                image.onload = function() {
                    deferred.resolve();

                    if ( state !== frame.state() || url !== state.props.get('url') ) {
                        return;
                    }

                    state.set({
                        type: 'image'
                    });

                    state.props.set({
                        width:  image.width,
                        height: image.height
                    });
                };

                image.onerror = deferred.reject;
                image.src = url;
            },

            refresh: function() {
                this.frame.toolbar.get().refresh();
            },

            reset: function() {
                this.props.clear().set({ url: '' });

                if ( this.active ) {
                    this.refresh();
                }
            }
        });

        wp.media.view.MediaFrame.Select = wp.media.view.MediaFrame.extend({


            initialize: function() {
                // Call 'initialize' directly on the parent class.
                wp.media.view.MediaFrame.prototype.initialize.apply( this, arguments );

                _.defaults( this.options, {
                    selection: [],
                    library:   {},
                    multiple:  false,
                    state:    'library'
                });

                this.createSelection();
                this.createStates();
                this.bindHandlers();
            },

            /**
             * Attach a selection collection to the frame.
             *
             * A selection is a collection of attachments used for a specific purpose
             * by a media frame. e.g. Selecting an attachment (or many) to insert into
             * post content.
             *
             * @see media.model.Selection
             */
            createSelection: function() {
                var selection = this.options.selection;

                if ( ! (selection instanceof wp.media.model.Selection) ) {
                    this.options.selection = new wp.media.model.Selection( selection, {
                        multiple: this.options.multiple
                    });
                }

                this._selection = {
                    attachments: new wp.media.model.Attachments(),
                    difference: []
                };
            },

            /**
             * Create the default states on the frame.
             */
            createStates: function() {
                var options = this.options;

                if ( this.options.states ) {
                    return;
                }

                // Add the default states.
                this.states.add([
                    // Main states.
                    new wp.media.controller.Library({
                        library:   wp.media.query( options.library ),
                        multiple:  options.multiple,
                        title:     options.title,
                        priority:  20
                    })
                ]);
            },

            /**
             * Bind region mode event callbacks.
             *
             * @see media.controller.Region.render
             */
            bindHandlers: function() {
                this.on( 'router:create:browse', this.createRouter, this );
                this.on( 'router:render:browse', this.browseRouter, this );
                this.on( 'content:create:browse', this.browseContent, this );
                this.on( 'content:render:upload', this.uploadContent, this );
                this.on( 'content:render:embed', this.embedContent, this );
                this.on( 'toolbar:create:select', this.createSelectToolbar, this );
                this.on( 'content:deactivate:embed', function(){this.toolbar.get().get('createEmbedElement').$el.hide();}, this);
            },

            /**
             * Render callback for the router region in the `browse` mode.
             *
             * @param {wp.media.view.Router} routerView
             */
            browseRouter: function( routerView ) {
                routerView.set({
                    upload: {
                        text:     'upload',
                        priority: 20
                    },
                    browse: {
                        text:     'browse',
                        priority: 40
                    },
                    embed: {
                        text:     'embed',
                        priority: 10
                    }
                });
            },

            /**
             * Render callback for the content region in the `browse` mode.
             *
             * @param {wp.media.controller.Region} contentRegion
             */
            browseContent: function( contentRegion ) {
                var state = this.state();

                this.$el.removeClass('hide-toolbar');

                // Browse our library of attachments.
                contentRegion.view = new wp.media.view.AttachmentsBrowser({
                    controller: this,
                    collection: state.get('library'),
                    selection:  state.get('selection'),
                    model:      state,
                    sortable:   state.get('sortable'),
                    search:     state.get('searchable'),
                    filters:    state.get('filterable'),
                    date:       state.get('date'),
                    display:    state.has('display') ? state.get('display') : state.get('displaySettings'),
                    dragInfo:   state.get('dragInfo'),

                    idealColumnWidth: state.get('idealColumnWidth'),
                    suggestedWidth:   state.get('suggestedWidth'),
                    suggestedHeight:  state.get('suggestedHeight'),

                    AttachmentView: state.get('AttachmentView')
                });
            },

            /**
             * Render callback for the content region in the `upload` mode.
             */
            uploadContent: function() {
                this.$el.removeClass( 'hide-toolbar' );
                this.content.set( new wp.media.view.UploaderInline({
                    controller: this
                }) );
            },

            /**
             * Render callback for the content region in the `embed` mode.
             */
            embedContent: function() {
                this.toolbar.get().get('createEmbedElement').$el.show();

                this.$el.removeClass( 'hide-toolbar' );
                this.content.set( new wp.media.view.Embed({
                    controller: this,
                    model:      this.state()
                }).render() );
            },

            /**
             * Toolbars
             *
             * @param {Object} toolbar
             * @param {Object} [options={}]
             * @this wp.media.controller.Region
             */
            createSelectToolbar: function (toolbar, options) {
                options = options || this.options.button || {};
                options.controller = this;

                toolbar.view = new wp.media.view.Toolbar.Select(options);

                toolbar.view.set("createEmbedElement", {
                    style: "primary",
                    priority: 80,
                    text: "Create embed element",
                    click: function () {
                        if ('' == options.controller.state().props.get('url')) {
                            return false;
                        }

                        $.ajax({
                            type: 'POST',
                            url: wp.ajax.settings.url,
                            context: this,
                            data: {
                                action: 'foogallery_store_embed',
                                post_id: wp.media.view.settings.post.id,
                                url: options.controller.state().props.get('url')
                            }
                        })
                            .done(function (attachment) {
                                // console.log(options.controller.state().get('library'));
                                // collection: options.controller.state().get('library'),
                                //     selection:  options.controller.state().get('selection'),
                                //     controller: options.controller,
                                //     model: options.controller.state()

                                options.controller.state().trigger('reset' );
                                options.controller.state().frame.content.mode('browse');
                                var a = wp.media.model.Attachment.create( attachment.data );
                                options.controller.state().get('selection').add(a);
                                options.controller.state().get('library')._requery(true);
                            })
                            .fail(function () {
                                alert('error')
                            });
                    }
                });
                toolbar.view.get('createEmbedElement').$el.hide();
            }
        });

		// Create the media frame.
		FOOGALLERY.media_uploader = wp.media.frames.file_frame = wp.media({
			title: FOOGALLERY.mediaModalTitle,
			//frame: 'post',
			button: {
				text: FOOGALLERY.mediaModalButtonText
			},
			multiple: 'add',  // Set to allow multiple files to be selected
			toolbar:  'select'
		});

		// When an image is selected, run a callback.
		FOOGALLERY.media_uploader
			.on( 'select', function() {
				var attachments = FOOGALLERY.media_uploader.state().get('selection').toJSON();

				$.each(attachments, function(i, item) {
                    if (item && item.id) {
                        if(item.mime == 'text/html'){
                            var attachment = {
                                id: item.id,
                                src: item.icon
                            }
                        }
                        else if (item.sizes && item.sizes.thumbnail) {
                            var attachment = {
                                id: item.id,
                                src: item.sizes.thumbnail.url
                            };
                        } else {
                            //thumbnail could not be found for whatever reason
                            var attachment = {
                                id: item.id,
                                src: item.url
                            };
                        }

                        FOOGALLERY.addAttachmentToGalleryList(attachment);
                    } else {
                        //there was a problem adding the item! Move on to the next
                    }
				});
			})
			.on( 'open', function() {
				var selection = FOOGALLERY.media_uploader.state().get('selection');
				if (selection) { selection.set(); }   //clear any previos selections

				if (FOOGALLERY.selected_attachment_id > 0) {
					var attachment = wp.media.attachment(FOOGALLERY.selected_attachment_id);
					attachment.fetch();
					selection.add( attachment ? [ attachment ] : [] );
				} else {
					//would be nice to have all previously added media selected
				}
			});

		// Finally, open the modal
		FOOGALLERY.media_uploader.open();
	};

	FOOGALLERY.initUsageMetabox = function() {
		$('#foogallery_create_page').on('click', function(e) {
			e.preventDefault();

			$('#foogallery_create_page_spinner').css('display', 'inline-block');
			var data = 'action=foogallery_create_gallery_page' +
				'&foogallery_id=' + $('#post_ID').val() +
				'&foogallery_create_gallery_page_nonce=' + $('#foogallery_create_gallery_page_nonce').val() +
				'&_wp_http_referer=' + encodeURIComponent($('input[name="_wp_http_referer"]').val());

			$.ajax({
				type: "POST",
				url: ajaxurl,
				data: data,
				success: function(data) {
					//refresh page
					location.reload();
				}
			});
		});
	};

    FOOGALLERY.adminReady = function () {
        $('.upload_image_button').on('click', function(e) {
            e.preventDefault();
			FOOGALLERY.mediaModalTitle = $(this).data( 'uploader-title' );
			FOOGALLERY.mediaModalButtonText = $(this).data( 'uploader-button-text' );
			FOOGALLERY.openMediaModal(0);
        });

        FOOGALLERY.initAttachments();

		FOOGALLERY.initSettings();

		FOOGALLERY.initUsageMetabox();

        $('.foogallery-attachments-list')
            .on('click' ,'a.remove', function(e) {
				e.preventDefault();
                var $selected = $(this).parents('li:first'),
					attachment_id = $selected.data('attachment-id');
                FOOGALLERY.removeAttachmentFromGalleryList(attachment_id);
            })
			.on('click' ,'a.info', function() {
				var $selected = $(this).parents('li:first'),
					attachment_id = $selected.data('attachment-id');
				FOOGALLERY.showAttachmentInfoModal(attachment_id);
			})
            .sortable({
                items: 'li:not(.add-attachment)',
                distance: 10,
                placeholder: 'attachment placeholder',
                stop : function() {
                    FOOGALLERY.calculateAttachmentIds();
                }
            });

		//init any colorpickers
		$('.colorpicker').spectrum({
			preferredFormat: "rgb",
			showInput: true,
			clickoutFiresChange: true
		});
    };

}(window.FOOGALLERY = window.FOOGALLERY || {}, jQuery));

jQuery(function ($) {
	if ( $('#foogallery_attachments').length > 0 ) {
		FOOGALLERY.adminReady();
	}
});