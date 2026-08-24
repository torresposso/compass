# Compass Domain Glossary

This document defines the canonical domain vocabulary for Compass, a deterministic astrological chart engine and profile management CLI.

## Core Concepts

### Chart
An astrological chart calculated for a specific UTC date/time and geographic observer position, containing planetary positions, houses, angles, and aspect relationships computed via Caelus.

### ChartEngine
The core calculation module providing chart computation, house normalization, and JWGEA (Jeffrey Wolf Green Evolutionary Astrology) evolutionary analysis behind a unified interface.

### GeoLocation
A geographic observer location represented by validated `Latitude` ([-90, +90]) and `Longitude` ([-180, +180]) coordinates.

### JWGEA Analysis
Jeffrey Wolf Green Evolutionary Astrology metadata derived from a chart, including the Pluto Polarity Point (PPP), lunar nodes (North Node and South Node with respective planetary rulers), and planetary skipped steps (planets squaring the nodal axis).

### Profile
A persisted birth record identified by a validated `ProfileSlug` containing birth date/time, geographic coordinates, and default house system preferences.
