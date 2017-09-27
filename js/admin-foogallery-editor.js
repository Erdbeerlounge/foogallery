//

(function(FOOGALLERY, $, undefined) {

	FOOGALLERY.limit = 25;
	FOOGALLERY.page = 0;

	FOOGALLERY.loadGalleries = function() {
		$('.foogallery-modal-wrapper .spinner').addClass('is-active');
		$('.foogallery-modal-reload').hide();
		$('.foogallery-modal-prevpage').hide();
		$('.foogallery-modal-nextpage').hide();
		$('[name="foogallery_search"]').hide();
		$('.foogallery-modal-search').hide();
		var data = 'action=foogallery_load_galleries' +
			'&foogallery_load_galleries=' + $('#foogallery_load_galleries').val() +
			'&_wp_http_referer=' + encodeURIComponent($('input[name="_wp_http_referer"]').val()) +
			'&foogallery_search=' + encodeURIComponent($('input[name="foogallery_search"]').val()) +
			'&foogallery_limit=' + FOOGALLERY.limit +
			'&foogallery_page=' + FOOGALLERY.page;

		$.ajax({
			type: "POST",
			url: ajaxurl,
			data: data,
			success: function(data) {
				$('.foogallery-attachment-container').html(data);
				FOOGALLERY.clearSelection();
			},
			complete: function() {
				$('.foogallery-modal-wrapper .spinner').removeClass('is-active');
				$('.foogallery-modal-reload').show();
				$('.foogallery-modal-prevpage').show();
				$('.foogallery-modal-nextpage').show();
				$('[name="foogallery_search"]').show();
				$('.foogallery-modal-search').show();
			}
		});
	};

	//hook up the extensions search
	FOOGALLERY.bindEditorButton = function() {
		$('.foogallery-modal-trigger').on('click', function(e) {
			e.preventDefault();
			$('.foogallery-modal-wrapper').show();
			if ( $('.foogallery-modal-loading').length ) {
				FOOGALLERY.loadGalleries();
			} else {
				FOOGALLERY.clearSelection();
			}
		});
	};

	FOOGALLERY.bindModalElements = function() {
		$('.media-modal-close, .foogallery-modal-cancel').on('click', function() {
			$('.foogallery-modal-wrapper').hide();
		});

		$('.foogallery-modal-reload').on('click', function(e) {
			e.preventDefault();
			FOOGALLERY.loadGalleries();
		});

		$('.foogallery-modal-prevpage').on('click', function(e) {
			e.preventDefault();
			if(FOOGALLERY.page > 0) FOOGALLERY.page--;
			FOOGALLERY.loadGalleries();
		});

		$('.foogallery-modal-nextpage').on('click', function(e) {
			e.preventDefault();
			FOOGALLERY.page++;
			FOOGALLERY.loadGalleries();
		});

		$('.foogallery-modal-search').on('click', function(e) {
			e.preventDefault();
			FOOGALLERY.page = 0;
			FOOGALLERY.loadGalleries();
		});

		$('.foogallery-modal-wrapper').on('click', '.foogallery-gallery-select', function(e) {
			var $this = $(this);
			if ( $this.is('.foogallery-add-gallery') ) {
				//if the add icon is click then do nothing
				return;
			} else {
				$('.foogallery-gallery-select').removeClass('selected');
				$(this).addClass('selected');
				FOOGALLERY.changeSelection();
			}
		});

		$('.foogallery-modal-insert').on('click', function(e) {
			e.preventDefault();
			if ( $(this).attr('disabled') ) {
				return;
			}
			var shortcode_tag = window.FOOGALLERY_SHORTCODE || 'foogallery',
				shortcode = '[' + shortcode_tag + ' id="' + $('.foogallery-gallery-select.selected').data('foogallery-id') + '"]';
			wp.media.editor.insert(shortcode);
			$('.foogallery-modal-wrapper').hide();
		});

		$('.eblgallery-modal-insert').on('click', function(e) {
			e.preventDefault();
			if ( $(this).attr('disabled') ) {
				return;
			}
			var shortcode = '[eblgallery id="' + $('[data-eblgallery-id]', '.foogallery-gallery-select.selected').data('eblgallery-id') + '" title=""]';
			wp.media.editor.insert(shortcode);
			$('.foogallery-modal-wrapper').hide();
		});
	};

	FOOGALLERY.changeSelection = function() {
		var selected = $('.foogallery-gallery-select.selected');
		if (selected.length) {
			$('.foogallery-modal-insert').removeAttr('disabled');
			if($("[data-eblgallery-id]", selected).length) {
				$('.eblgallery-modal-insert').removeAttr('disabled');
			} else {
				$('.eblgallery-modal-insert').attr('disabled', 'disabled');
			}
		} else {
			$('.foogallery-modal-insert').attr('disabled', 'disabled');
			$('.eblgallery-modal-insert').attr('disabled', 'disabled');
		}
	};

	FOOGALLERY.clearSelection = function() {
		$('.foogallery-gallery-select').removeClass('selected');
		FOOGALLERY.changeSelection();
	};

	$(function() { //wait for ready
		FOOGALLERY.bindEditorButton();
		FOOGALLERY.bindModalElements();
	});
}(window.FOOGALLERY = window.FOOGALLERY || {}, jQuery));