package epub

import "encoding/xml"

type Container struct {
    XMLName   xml.Name  `xml:"urn:oasis:names:tc:opendocument:xmlns:container container"`
    RootFiles RootFiles `xml:"rootfiles"`
}

type RootFiles struct {
    RootFile []RootFile `xml:"rootfile"`
}

type RootFile struct {
    FullPath  string `xml:"full-path,attr"`
    MediaType string `xml:"media-type,attr"`
}

type Package struct {
    XMLName  xml.Name `xml:"package"`
    Metadata Metadata `xml:"metadata"`
    Manifest Manifest `xml:"manifest"`
    Spine    Spine    `xml:"spine"`
    RootDir  string 
}

type Metadata struct {
    Title string `xml:"title"`
}

type Manifest struct {
    Items []Item `xml:"item"`
}

type Item struct {
    ID        string `xml:"id,attr"`
    Href      string `xml:"href,attr"`
    MediaType string `xml:"media-type,attr"`
}

type Spine struct {
    ItemRefs []ItemRef `xml:"itemref"`
}

type ItemRef struct {
    IDRef string `xml:"idref,attr"`
}