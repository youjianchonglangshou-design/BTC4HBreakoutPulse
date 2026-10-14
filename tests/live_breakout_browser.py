"""Compatibility entrypoint: the old after-20:00 overlay is no longer an active feature.
Run the actual v7.0 pre-20:00, 20:00 freeze, and post-20:00 quote browser integration.
"""
from pathlib import Path
import runpy
runpy.run_path(str(Path(__file__).with_name('regime_v7_browser.py')),run_name='__main__')
