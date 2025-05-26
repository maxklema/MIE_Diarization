from pybind11.setup_helpers import Pybind11Extension, build_ext
from setuptools import setup, find_packages
import sys

ext_modules = [
    Pybind11Extension(
        "ctc_forced_aligner.ctc_forced_aligner",
        ["ctc_forced_aligner/forced_align_impl.cpp"],
        extra_compile_args=["/O2"] if sys.platform == "win32" else ["-O3"],
    )
]

setup(
    name="ctc_forced_aligner",             # Name added
    version="0.1.0",                        #Version added
    packages=find_packages(),              #So Python can find  modules
    ext_modules=ext_modules,
    cmdclass={"build_ext": build_ext},
    zip_safe=False,
)