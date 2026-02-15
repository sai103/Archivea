import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:syncfusion_flutter_pdfviewer/pdfviewer.dart';

void main() {
  runApp(const ArchiveaReaderApp());
}

class ArchiveaReaderApp extends StatelessWidget {
  const ArchiveaReaderApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Archivea Reader',
      theme: ThemeData(colorSchemeSeed: Colors.indigo, useMaterial3: true),
      home: const DocumentListScreen(apiBaseUrl: 'http://10.0.2.2:8000'),
    );
  }
}

class DocumentItem {
  const DocumentItem({required this.id, required this.title, required this.mimeType});

  final int id;
  final String title;
  final String mimeType;

  factory DocumentItem.fromJson(Map<String, dynamic> json) {
    return DocumentItem(
      id: json['id'] as int,
      title: json['title'] as String,
      mimeType: json['mime_type'] as String,
    );
  }
}

class ZipPageItem {
  const ZipPageItem({required this.index, required this.contentUrl});

  final int index;
  final String contentUrl;

  factory ZipPageItem.fromJson(Map<String, dynamic> json) {
    return ZipPageItem(
      index: json['index'] as int,
      contentUrl: json['content_url'] as String,
    );
  }
}

class DocumentListScreen extends StatefulWidget {
  const DocumentListScreen({super.key, required this.apiBaseUrl});

  final String apiBaseUrl;

  @override
  State<DocumentListScreen> createState() => _DocumentListScreenState();
}

class _DocumentListScreenState extends State<DocumentListScreen> {
  late Future<List<DocumentItem>> _documents;

  @override
  void initState() {
    super.initState();
    _documents = _fetchDocuments();
  }

  Future<List<DocumentItem>> _fetchDocuments() async {
    final response = await http.get(Uri.parse('${widget.apiBaseUrl}/documents'));
    if (response.statusCode != 200) {
      throw Exception('Failed to load documents: ${response.statusCode}');
    }

    final list = jsonDecode(response.body) as List<dynamic>;
    return list
        .map((item) => DocumentItem.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Archivea Reader')),
      body: FutureBuilder<List<DocumentItem>>(
        future: _documents,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }

          if (snapshot.hasError) {
            return Center(child: Text('Error: ${snapshot.error}'));
          }

          final documents = snapshot.data ?? const [];
          if (documents.isEmpty) {
            return const Center(child: Text('ドキュメントがありません'));
          }

          return ListView.builder(
            itemCount: documents.length,
            itemBuilder: (context, index) {
              final doc = documents[index];
              return ListTile(
                title: Text(doc.title),
                subtitle: Text(doc.mimeType),
                trailing: const Icon(Icons.chevron_right),
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => DocumentViewerScreen(
                        apiBaseUrl: widget.apiBaseUrl,
                        document: doc,
                      ),
                    ),
                  );
                },
              );
            },
          );
        },
      ),
    );
  }
}

class DocumentViewerScreen extends StatelessWidget {
  const DocumentViewerScreen({
    super.key,
    required this.apiBaseUrl,
    required this.document,
  });

  final String apiBaseUrl;
  final DocumentItem document;

  @override
  Widget build(BuildContext context) {
    final contentUrl = '$apiBaseUrl/documents/${document.id}/content';

    if (document.mimeType == 'application/pdf') {
      return Scaffold(
        appBar: AppBar(title: Text(document.title)),
        body: SfPdfViewer.network(contentUrl),
      );
    }

    if (document.mimeType == 'application/zip') {
      return ZipImageViewerScreen(apiBaseUrl: apiBaseUrl, document: document);
    }

    return Scaffold(
      appBar: AppBar(title: Text(document.title)),
      body: InteractiveViewer(
        child: Center(child: Image.network(contentUrl)),
      ),
    );
  }
}

class ZipImageViewerScreen extends StatefulWidget {
  const ZipImageViewerScreen({
    super.key,
    required this.apiBaseUrl,
    required this.document,
  });

  final String apiBaseUrl;
  final DocumentItem document;

  @override
  State<ZipImageViewerScreen> createState() => _ZipImageViewerScreenState();
}

class _ZipImageViewerScreenState extends State<ZipImageViewerScreen> {
  static const double _twoPageMinWidth = 900;
  late Future<List<ZipPageItem>> _pages;
  bool _isTwoPageMode = false;

  @override
  void initState() {
    super.initState();
    _pages = _fetchPages();
  }

  Future<List<ZipPageItem>> _fetchPages() async {
    final response = await http.get(
      Uri.parse('${widget.apiBaseUrl}/documents/${widget.document.id}/pages'),
    );
    if (response.statusCode != 200) {
      throw Exception('Failed to load ZIP pages: ${response.statusCode}');
    }

    final list = jsonDecode(response.body) as List<dynamic>;
    return list
        .map((item) => ZipPageItem.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    final isWideScreen = MediaQuery.of(context).size.width >= _twoPageMinWidth;

    if (!isWideScreen && _isTwoPageMode) {
      _isTwoPageMode = false;
    }

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.document.title),
        actions: [
          if (isWideScreen)
            IconButton(
              onPressed: () {
                setState(() {
                  _isTwoPageMode = !_isTwoPageMode;
                });
              },
              tooltip: _isTwoPageMode ? '1ページ表示に切替' : '2ページ表示に切替',
              icon: Icon(_isTwoPageMode ? Icons.filter_1 : Icons.view_week),
            ),
        ],
      ),
      body: FutureBuilder<List<ZipPageItem>>(
        future: _pages,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }

          if (snapshot.hasError) {
            return Center(child: Text('Error: ${snapshot.error}'));
          }

          final pages = snapshot.data ?? const [];
          if (pages.isEmpty) {
            return const Center(child: Text('ZIPにJPGページがありません'));
          }

          final pagesPerScreen = _isTwoPageMode ? 2 : 1;
          final spreadCount = (pages.length / pagesPerScreen).ceil();

          return PageView.builder(
            itemCount: spreadCount,
            itemBuilder: (context, spreadIndex) {
              final firstPageIndex = spreadIndex * pagesPerScreen;
              final secondPageIndex = firstPageIndex + 1;

              final firstPage = pages[firstPageIndex];
              final firstImageUrl = '${widget.apiBaseUrl}${firstPage.contentUrl}';
              final secondPage =
                  secondPageIndex < pages.length ? pages[secondPageIndex] : null;
              final secondImageUrl = secondPage != null
                  ? '${widget.apiBaseUrl}${secondPage.contentUrl}'
                  : null;

              return Column(
                children: [
                  Padding(
                    padding: const EdgeInsets.all(8),
                    child: Text(
                      _isTwoPageMode
                          ? 'Page ${firstPageIndex + 1}-${secondPage != null ? secondPageIndex + 1 : pages.length} / ${pages.length}'
                          : 'Page ${firstPageIndex + 1} / ${pages.length}',
                    ),
                  ),
                  Expanded(
                    child: Row(
                      children: [
                        Expanded(
                          child: InteractiveViewer(
                            child: Center(child: Image.network(firstImageUrl)),
                          ),
                        ),
                        if (_isTwoPageMode)
                          Expanded(
                            child: secondImageUrl == null
                                ? const SizedBox.shrink()
                                : InteractiveViewer(
                                    child: Center(
                                      child: Image.network(secondImageUrl),
                                    ),
                                  ),
                          ),
                      ],
                    ),
                  ),
                ],
              );
            },
          );
        },
      ),
    );
  }
}
