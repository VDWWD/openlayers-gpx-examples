var map;
var overlay;
var interaction;
var featureArr;
var $popup;
var styles = {
    'track-red': new ol.style.Style({
        stroke: new ol.style.Stroke({
            color: '#ff0000',
            width: 3,
        }),
    }),
    'track-black': new ol.style.Style({
        stroke: new ol.style.Stroke({
            color: '#000000',
            width: 3,
        }),
    }),
};


//initialize the map
function initMap() {
    if ($('#map').length === 0)
        return;

    $popup = $('#map-popup');

    //create the map object
    map = new ol.Map({
        target: 'map',
        layers: [
            new ol.layer.Tile({
                source: new ol.source.OSM()
            })
        ],
        view: new ol.View({
            center: ol.proj.fromLonLat([5.6461, 52.1008]),
            zoom: 7,
            maxZoom: 16,
            constrainResolution: true
        }),
        controls: []
    });

    //add a custom layer to the map
    //olms.apply(map, 'https://api.maptiler.com/maps/basic/style.json?key=XXXXX');

    //create an overlay to anchor the hover popup to the map
    overlay = new ol.Overlay({
        element: document.getElementById('map-popup'),
        autoPan: {
            animation: {
                duration: 250,
            }
        }
    });

    //add the overlay to the map
    map.addOverlay(overlay);

    //add a mousemove function to the map to detect a marker and if found show popup
    map.on('pointermove', function (e) {
        var feature = map.forEachFeatureAtPixel(e.pixel, function (feat, layer) {
            return feat;
        });

        //get the current position of the mouse in pixels relative to the map div container
        //console.log(e.pixel)

        //show the marker info if there is a name property and it has contents
        if (feature && typeof feature.get('name') != 'undefined' && feature.get('name') != null && feature.get('name') !== '') {
            $popup.html(feature.get('name'));
            overlay.setPosition(e.coordinate);
        } else {
            overlay.setPosition(null);
        }
    });
}


//add a marker to the map
function addMarker(id, name, color, lat, lng, draggable, custom_marker, custom_layer) {
    //create a feature
    var feature = new ol.Feature({
        geometry: new ol.geom.Point(ol.proj.fromLonLat([lng, lat])),
        name: name,
        id: id,
        type: 'marker'
    });

    var markerimg = '/images/marker-' + color + '.png';
    if (custom_marker != null && custom_marker !== '') {
        markerimg = custom_marker;
    }

    //create an icon style with an image as marker
    var style = new ol.style.Style({
        image: new ol.style.Icon(({
            anchor: [0.5, 0.5],
            src: markerimg
        }))
    });

    //or create an icon style with a shape as marker
    //var style = new ol.style.Style({
    //    image: new ol.style.Circle({
    //        radius: 10,
    //        stroke: new ol.style.Stroke({
    //            color: 'black',
    //            width: 3
    //        }),
    //        fill: new ol.style.Fill({
    //            color: 'white'
    //        }),
    //    })
    //});

    //add the style to the feature
    feature.setStyle(style);

    //create a layer and add the feature
    var layer = new ol.layer.Vector({
        source: new ol.source.Vector({
            features: [feature]
        }),
        name: name,
        type: 'marker',
        zIndex: 100
    });

    //is there a custom layer
    if (custom_layer != null) {
        custom_layer.getSource().addFeature(feature);
        layer = custom_layer;
    } else {
        //add the layer to the map
        map.addLayer(layer);
    }

    //no draggable marker
    if (!draggable)
        return;

    //add a modifier
    var modify = new ol.interaction.Modify({
        hitDetection: layer,
        source: layer.getSource()
    });

    //needed variables
    var container = document.getElementById('map-container');
    var overlay = modify.getOverlay().getSource();

    //modify handlers
    modify.on(['modifystart', 'modifyend'], function (e) {
        container.style.cursor = e.type === 'modifystart' ? 'grabbing' : 'pointer';
    });

    overlay.on(['addfeature', 'removefeature'], function (e) {
        container.style.cursor = e.type === 'addfeature' ? 'pointer' : '';
    });

    //get the coordinates during drag
    feature.on('change', function () {
        //console.log(ol.proj.toLonLat(this.getGeometry().getCoordinates()));
    }, feature);

    //add the modifier to the map
    map.addInteraction(modify);
}


//load a gpx file from an url
function addGpxFromUrl(url) {

    //create a layer
    var layer = new ol.layer.Vector({
        source: new ol.source.Vector({
            url: url,
            format: new ol.format.GPX()
        }),
        style: function () {
            return styles['track-red'];
        },
        name: 'GpxFromUrl',
        type: 'track',
        zIndex: 100
    });

    //add the layer to the map
    map.addLayer(layer);

    //bind a listeret to the layer (needed becaue loading the source from an url is async)
    layer.getSource().on('addfeature', function (e) {
        //get the coordinates from the layer
        var coords = e.feature.getGeometry().clone().transform('EPSG:3857', 'EPSG:4326');

        //put the coordinates in a html element (to use elsewhere or post it to the server)
        $('#map-gpx').val(JSON.stringify(coords.getCoordinates()[0]));

        //add a marker to the first coordinate
        addMarker(1, 'Starting Point', 'blue', coords.getFirstCoordinate()[1], coords.getFirstCoordinate()[0], false);

        //zoom and fit bounds
        var geom = ol.geom.Polygon.fromExtent(layer.getSource().getExtent())
        geom.scale(1.1);
        map.getView().fit(geom, { size: map.getSize() });
    });
}


//load a gpx file from a string variable
function addGpxFromString(gpx, name, color) {

    //remove the existing layer
    removeLayer(name);

    //create a layer
    var layer = new ol.layer.Vector({
        source: new ol.source.Vector({}),
        style: function () {
            return styles['track-' + color];
        },
        name: name,
        type: 'track',
        zIndex: 100
    });

    //read the features from the gpx
    var features = new ol.format.GPX().readFeatures(gpx, {
        dataProjection: 'EPSG:4326',
        featureProjection: 'EPSG:3857'
    });

    //add the features to the layer
    layer.getSource().addFeatures(features);

    //add the layer to the map
    map.addLayer(layer);

    //get the coordinates from the layer
    var coords = features[0].getGeometry().clone().transform('EPSG:3857', 'EPSG:4326');

    //put the coordinates in a html element (to use elsewhere or post it to the server)
    var $mapgpx = $('#map-gpx');
    $mapgpx.val(JSON.stringify(coords.getCoordinates()));
    $mapgpx.show();

    //add a marker to the first coordinate
    addMarker(1, 'Starting Point', color, coords.getFirstCoordinate()[1], coords.getFirstCoordinate()[0], false);

    //zoom and fit bounds
    var geom = ol.geom.Polygon.fromExtent(layer.getSource().getExtent())
    geom.scale(1.1);
    map.getView().fit(geom, { size: map.getSize() });
}


//enable dragging and dropping a gpx track on the map
function addGpxFromDragDrop() {

    //if an interaction exists remove it first
    if (interaction) {
        map.removeInteraction(interaction);
    }

    //create the interaction
    interaction = new ol.interaction.DragAndDrop({
        formatConstructors: [
            ol.format.GPX
        ],
    });

    //on drag event
    interaction.on('addfeatures', function (e) {
        //create a layer
        var layer = new ol.layer.Vector({
            source: new ol.source.Vector({
                features: e.features,
            }),
            style: function () {
                return styles['track-red'];
            },
            name: 'GpxFromDragDrop',
            type: 'track',
            zIndex: 100
        });

        //add the layer to the map
        map.addLayer(layer);

        //get the coordinates from the layer
        var coords = e.features[0].getGeometry().clone().transform('EPSG:3857', 'EPSG:4326');

        //put the coordinates in a html element (to use elsewhere or post it to the server)
        $('#map-gpx').val(JSON.stringify(coords.getCoordinates()[0]));

        //add a marker to the first coordinate
        addMarker(1, 'Starting Point', 'blue', coords.getFirstCoordinate()[1], coords.getFirstCoordinate()[0], false);

        //zoom and fit bounds
        var geom = ol.geom.Polygon.fromExtent(layer.getSource().getExtent())
        geom.scale(1.1);
        map.getView().fit(geom, { size: map.getSize() });
    });

    //add the interaction to the map
    map.addInteraction(interaction);
}


//add a gpx with a html file upload control
function addGpxFromFileUpload() {

    //bind a change event to the control
    $('#map-upload').bind('change', function () {
        var $this = $(this);
        var gpxfile = document.getElementById($this.prop('id')).files[0];

        //create a reader
        var reader = new FileReader();
        reader.onload = function (e) {
            addGpxFromString(e.target.result, 'GpxFromFileUpload', 'red');
        };

        reader.readAsText(gpxfile);
        $this.val('');
    });
}


//add a gpx track from an array of single points [[52.8058, 6.7958], [52.8056, 6.7957], ... ]
function addGpxFromPoints(gpx, name, animate) {

    //openlayers uses [lon, lat], not [lat, lon]
    if (gpx[0][0] > 20 && gpx[0][1] < 20) {
        gpx.map(function (l) {
            return l.reverse();
        });
    }

    //create a geometry from the coordinates
    var geometry = new ol.geom.LineString(gpx).transform('EPSG:4326', 'EPSG:3857');

    //create a layer
    var layer = new ol.layer.Vector({
        source: new ol.source.Vector({
            features: [
                new ol.Feature({
                    geometry: geometry,
                    name: name
                })
            ]
        }),
        style: function () {
            return styles['track-black'];
        },
        name: name,
        type: 'track',
        zIndex: 100
    });

    //add the layer to the map
    map.addLayer(layer);

    //add a marker to the first coordinate
    addMarker(2, name + ' - Start', 'black', gpx[0][1], gpx[0][0], false);

    //zoom and fit bounds
    var geom = ol.geom.Polygon.fromExtent(layer.getSource().getExtent())
    geom.scale(1.1);
    map.getView().fit(geom, { size: map.getSize() });

    //add a line animation
    if (animate) {
        animateLine(geometry, name + ' - Rijrichting');
    }
}


//add multiple markers from an array
function addMultipleMarkers(markerArr, soort) {
    var markerimg = '/images/site/marker-' + soort + '.png';
    var markerimg_hover = '/images/site/marker-' + soort + '-red.png';
    var url = '/toertochten/';

    if (soort === 'club')
        url = '/clubs/';
    else if (soort == 'track')
        url = '/routes/';

    var normalstyle = new ol.style.Style({
        image: new ol.style.Icon(({
            anchor: [0.5, 0.5],
            src: markerimg
        })),
        zIndex: 100
    });

    var hoverstyle = new ol.style.Style({
        image: new ol.style.Icon(({
            anchor: [0.5, 0.5],
            src: markerimg_hover
        })),
        zIndex: 1000
    });

    //create a new layer
    var layer = new ol.layer.Vector({
        source: new ol.source.Vector(),
        style: normalstyle
    });

    //loop all the markers to add popover
    for (var i = 0; i < markerArr.length; i++) {
        var item = markerArr[i];

        layer.getSource().addFeature(
            new ol.Feature({
                geometry: new ol.geom.Point(ol.proj.fromLonLat([parseFloat(item.lng), parseFloat(item.lat)])),
                id: item.id,
                soort: 'icon',
                name: '<b>' + item.naam + '</b><br>' + item.regel2
            })
        );
    }

    featureArr = layer.getSource().getFeatures();

    //maak de marker rood on hover
    var hover = null;
    map.on('pointermove', function (evt) {
        map.getTargetElement().style.cursor = map.hasFeatureAtPixel(evt.pixel) ? 'pointer' : '';

        if (hover != null) {
            hover.setStyle(normalstyle);
            hover = null;
        }

        map.forEachFeatureAtPixel(evt.pixel, function (f) {
            if (f.get('soort') === 'icon') {
                hover = f;
                return true;
            } else {
                return false;
            }
        });

        if (hover) {
            hover.setStyle(hoverstyle);
        }
    });

    //voeg de laag toe aan de map
    map.addLayer(layer);

    //maak de marker clickable
    map.on('click', (e) => {
        map.forEachFeatureAtPixel(e.pixel, function (f) {
            if (f.get('soort') === 'icon') {
                location.href = url + hover.get('id');
                return true;
            } else {
                return false;
            }
        });
    });

    //zoom and fit bounds
    //var geom = ol.geom.Polygon.fromExtent(layer.getSource().getExtent())
    //geom.scale(1.1);
    //map.getView().fit(geom, { size: map.getSize() });
}


//add a click event to the map to get the clicked coordinate
function addClickEvent() {

    //create an overlay to anchor the hover popup to the map
    var clickOverlay = new ol.Overlay({
        element: document.getElementById('map-popup-click'),
        autoPan: {
            animation: {
                duration: 250,
            }
        }
    });

    //add the overlay to the map
    map.addOverlay(clickOverlay);

    //add the click event and show the popup
    var $popupclick = $('#map-popup-click');
    map.on('singleclick', function (e) {

        //if a popup is open then close it on map click
        if (clickOverlay.getPosition()) {
            clickOverlay.setPosition(null);
        } else {
            $popupclick.html('<p>You clicked here:</p><code>' + ol.proj.toLonLat(e.coordinate) + '</code>');
            clickOverlay.setPosition(e.coordinate);
        }
    });
}


//add a moving marker to a route
function animateLine(route, name) {
    var speed = 30;
    var distance = 0;
    var lasttime;
    var position = new ol.geom.Point(route.clone().getFirstCoordinate());

    var feature = new ol.Feature({
        geometry: position,
    });
    var startMarker = new ol.Feature({
        geometry: position,
    });
    var endMarker = new ol.Feature({
        geometry: position
    });

    //create an icon style with a shape as marker
    var style = new ol.style.Style({
        image: new ol.style.Circle({
            radius: 10,
            stroke: new ol.style.Stroke({
                color: 'black',
                width: 2
            }),
            fill: new ol.style.Fill({
                color: 'red'
            })
        })
    });

    //create a layer with the marker that will move
    var layer = new ol.layer.Vector({
        source: new ol.source.Vector({
            features: [feature, startMarker, endMarker],
        }),
        name: name,
        zIndex: 200
    });

    //add the layer to the map
    map.addLayer(layer);

    //function to move the marker
    function moveFeature(e) {
        var time = e.frameState.time;
        distance = (distance + (speed * (time - lasttime)) / 1e6) % 2;
        lasttime = time;

        //if the distance > 1 then the end has been reached so restart
        if (distance > 1) {
            stopAnimation();
            startAnimation();
        }

        //set the new coordinate for the marker
        position.setCoordinates(route.getCoordinateAt(distance));

        //draw it on the map
        var context = ol.render.getVectorContext(e);
        context.setStyle(style);
        context.drawGeometry(position);

        map.render();
    }


    //start the animation
    function startAnimation() {
        distance = 0;
        lasttime = Date.now();
        layer.on('postrender', moveFeature);
        feature.setGeometry(null);
    }


    //stop the animation
    function stopAnimation() {
        feature.setGeometry(position);
        layer.un('postrender', moveFeature);
    }

    //start
    startAnimation();
}


//remove a layer from the map
function removeLayer(name) {
    map.getLayers().forEach(layer => {
        if (layer && layer.get('name') === name) {
            map.removeLayer(layer);
        }
    });
}


//add multiple markers from an array and make them clustered
function addMultipleMarkersClustered(markerArr, soort) {
    var markerimg = '/images/site/marker-' + soort + '.png';
    var markerimg_hover = '/images/site/marker-' + soort + '-red.png';
    var url = '';

    //sort the array
    markerArr.sort((a, b) => a.lat - b.lat)

    //create the features
    featureArr = new Array(markerArr.length);
    var prevmarker;
    var offsetdefault = 0.0009;
    var offsettotal = offsetdefault;
    for (let i = 0; i < markerArr.length; ++i) {
        var item = markerArr[i];
        var point = new ol.geom.Point(ol.proj.fromLonLat([parseFloat(item.lng), parseFloat(item.lat)]));

        //if the features have the same coordinates move them slightly so they appear next to each other
        if (item.lng.toFixed(3) + '_' + item.lat.toFixed(3) === prevmarker) {
            point = new ol.geom.Point(ol.proj.fromLonLat([parseFloat(item.lng) + offsettotal, parseFloat(item.lat)]));
            offsettotal += offsetdefault;
        } else {
            offsettotal = offsetdefault;
        }

        featureArr[i] = new ol.Feature({
            geometry: point,
            id: item.id,
            soort: 'icon',
            name: '<b>' + item.naam + '</b><br>' + item.regel2
        });

        prevmarker = item.lng.toFixed(3) + '_' + item.lat.toFixed(3);
    }

    //create the source
    var clusterSource = new ol.source.Cluster({
        distance: 40,
        minDistance: 10,
        source: new ol.source.Vector({
            features: featureArr,
        })
    });

    //clustered style
    var zindex = 100;
    var clusters = new ol.layer.Vector({
        source: clusterSource,
        style: function (feature) {
            const size = feature.get('features').length;

            var radius = 12;
            var textsize = 1;
            var text = size.toString();

            //dynamic cluster marker size calculations
            if (size > 100) {
                radius = (size * 0.2);
                textsize = size / 60;
            } else if (size > 50) {
                radius = (size * 0.4);
                textsize = size / 25;
            } else if (size > 25) {
                radius = (size * 0.6);
                textsize = size / 20;
            } else if (size > 1) {
                radius = 15;
                textsize = 1.3;
            }

            //max markercluster size
            if (radius > 75) {
                radius = 75;
                textsize = 5;
            }

            var style = new ol.style.Style({
                image: new ol.style.Circle({
                    radius: radius,
                    fill: new ol.style.Fill({
                        color: 'black'
                    }),
                    stroke: new ol.style.Stroke({
                        color: 'white',
                        width: 1
                    }),
                }),
                text: new ol.style.Text({
                    text: text,
                    fill: new ol.style.Fill({
                        color: '#fff',
                    }),
                    scale: textsize,
                    offsetY: size > 50 ? 2 : 1
                }),
                zIndex: zindex
            });

            zindex++;
            return style;
        },
    });

    //create a tile layer
    var raster = new ol.layer.Tile({
        source: new ol.source.OSM()
    });

    //add the layers to the map
    map.addLayer(raster);
    map.addLayer(clusters);

    //make the marker clickable
    map.on('click', (e) => {
        clusters.getFeatures(e.pixel).then((clickedFeatures) => {
            if (clickedFeatures.length) {
                //get the clustered coordinates
                const features = clickedFeatures[0].get('features');

                //when there are multiple features do a zoom otherwise handle the click
                if (features.length > 1) {
                    const extent = ol.extent.boundingExtent(
                        features.map((r) => r.getGeometry().getCoordinates())
                    );

                    map.getView().fit(extent, { duration: 1000, padding: [50, 50, 50, 50] });
                } else {
                    location.href = url + features[0].get('id');
                }
            }
        });
    });

    //show a mouse pointer and popup on hover
    map.on('pointermove', function (e) {
        map.getTargetElement().style.cursor = map.hasFeatureAtPixel(e.pixel) ? 'pointer' : '';

        clusters.getFeatures(e.pixel).then((hoveredFeatures) => {
            if (hoveredFeatures.length) {
                //get the clustered coordinates
                const features = hoveredFeatures[0].get('features');

                //when there is a single features show the popup
                if (features.length === 1) {
                    if (features[0] && typeof features[0].get('name') != 'undefined' && features[0].get('name') != null && features[0].get('name') !== '') {
                        $popup.html(features[0].get('name'));
                        overlay.setPosition(e.coordinate);
                    } else {
                        overlay.setPosition(null);
                    }
                }
            }
        });
    });
}
